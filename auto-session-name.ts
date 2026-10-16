/**
 * Auto session name.
 *
 * Sets the session display name from your first user message, so you do not
 * rely on an AGENTS.md instruction to the model.
 *
 * Behaviour:
 * - Runs on the first user turn only, and only when no name is set yet.
 * - Makes a short (3-6 word) name with a quick call to the current model.
 * - Keeps a leading ticket ID (like ABC-123) at the front of the name.
 */

import { uuidv7 } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const TICKET_PATTERN = /^\s*([A-Z][A-Z0-9]+-\d+)\b/;
const MAX_NAME_LENGTH = 60;

const cleanName = (raw: string): string =>
	raw
		.replace(/^["'`\s]+|["'`\s]+$/g, "")
		.replace(/[.\s]+$/g, "")
		.replace(/\s+/g, " ")
		.slice(0, MAX_NAME_LENGTH)
		.trim();

const fallbackName = (prompt: string): string => {
	const firstLine = prompt.split("\n").find((line) => line.trim().length > 0) ?? prompt;
	return cleanName(firstLine) || "Untitled session";
};

const buildNamePrompt = (prompt: string): string =>
	[
		"Make a short session title from the user message below.",
		"Rules:",
		"- 3 to 6 words.",
		"- Title case.",
		"- No quotes, no trailing punctuation.",
		"- Describe the task, not the words.",
		"Reply with the title only.",
		"",
		"<message>",
		prompt,
		"</message>",
	].join("\n");

const generateName = async (prompt: string, ctx: ExtensionContext): Promise<string> => {
	const model = ctx.model;
	if (!model || !ctx.modelRegistry.hasConfiguredAuth(model)) {
		return fallbackName(prompt);
	}

	try {
		const response = await ctx.modelRegistry.complete(
			model,
			{
				messages: [
					{
						role: "user" as const,
						content: [{ type: "text" as const, text: buildNamePrompt(prompt) }],
						timestamp: Date.now(),
					},
				],
			},
			{ reasoningEffort: "low", cacheRetention: "none", sessionId: uuidv7() },
		);

		const text = response.content
			.filter((c): c is { type: "text"; text: string } => c.type === "text")
			.map((c) => c.text)
			.join(" ");

		const name = cleanName(text);
		return name || fallbackName(prompt);
	} catch {
		return fallbackName(prompt);
	}
};

const applyTicketPrefix = (prompt: string, name: string): string => {
	const match = prompt.match(TICKET_PATTERN);
	if (!match) {
		return name;
	}

	const ticket = match[1];
	if (name.toUpperCase().startsWith(ticket.toUpperCase())) {
		return name;
	}

	return cleanName(`${ticket} ${name}`);
};

export default function (pi: ExtensionAPI) {
	let handled = false;

	pi.on("before_agent_start", async (event, ctx) => {
		if (handled || event.messageType !== "user") {
			return;
		}
		if (pi.getSessionName()) {
			handled = true;
			return;
		}

		const prompt = event.prompt.trim();
		if (!prompt) {
			return;
		}

		// Guard before the async call so a second turn does not start a race.
		handled = true;

		// Await here so the work finishes while the context is valid.
		const name = applyTicketPrefix(prompt, await generateName(prompt, ctx));
		if (!pi.getSessionName()) {
			pi.setSessionName(name);
		}
	});
}
