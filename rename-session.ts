/**
 * Rename Session - lets the agent set the session display name.
 *
 * Registers a model-callable tool that calls setSessionName, so you can
 * ask the agent to rename the current session.
 */

import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const renameSessionTool = defineTool({
		name: "rename_session",
		label: "Rename Session",
		description:
			"Set the display name of the current session. Use this when the user asks to rename the session.",
		parameters: Type.Object({
			name: Type.String({ description: "New session display name" }),
		}),

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const previous = pi.getSessionName();
			pi.setSessionName(params.name);
			return {
				content: [{ type: "text", text: `Session renamed to "${params.name}".` }],
				details: { previous, name: params.name },
			};
		},
	});

	pi.registerTool(renameSessionTool);
}
