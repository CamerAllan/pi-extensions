/**
 * Tab title extension - sets the terminal tab title to show the session
 * name, total cost, and current status.
 *
 * Status values:
 *   - idle: no run active
 *   - working: the agent is running
 *   - needs input: a dialog is open and waits for you
 *   - waiting for you: the agent finished a turn
 *
 * Usage: pi -e ./tab-title.ts
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

type Status = "idle" | "working" | "needs input" | "waiting for you";

const STATUS_ICON: Record<Status, string> = {
	idle: "·",
	working: "⚙",
	"needs input": "❓",
	"waiting for you": "✓",
};

export default function (pi: ExtensionAPI) {
	let status: Status = "idle";
	// The run state that the status returns to after a dialog closes.
	let baseStatus: Status = "idle";

	const totalCost = (ctx: ExtensionContext): number => {
		let cost = 0;
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "message" && entry.message.role === "assistant") {
				cost += (entry.message as AssistantMessage).usage.cost.total;
			}
		}
		return cost;
	};

	const render = (ctx: ExtensionContext): void => {
		if (ctx.mode !== "tui") return;

		const name = ctx.sessionManager.getSessionName() || "pi";
		const cost = totalCost(ctx);
		const icon = STATUS_ICON[status];

		ctx.ui.setTitle(`${icon} ${status} · ${name} · $${cost.toFixed(3)}`);
	};

	const setBase = (next: Status, ctx: ExtensionContext): void => {
		baseStatus = next;
		status = next;
		render(ctx);
	};

	pi.on("session_start", async (_event, ctx) => setBase("idle", ctx));
	pi.on("session_info_changed", async (_event, ctx) => render(ctx));

	pi.on("agent_start", async (_event, ctx) => setBase("working", ctx));
	pi.on("agent_settled", async (_event, ctx) => setBase("waiting for you", ctx));

	pi.on("ui_prompt_start", async (_event, ctx) => {
		status = "needs input";
		render(ctx);
	});
	pi.on("ui_prompt_end", async (_event, ctx) => {
		// Return to the run state the dialog interrupted.
		status = baseStatus;
		render(ctx);
	});
}
