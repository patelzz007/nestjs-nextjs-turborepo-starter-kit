// The server agent's configuration: the ONE place it reads process.env (oxlint enforces it).

import { BooleanFlagEnvSchema, DEV_API_URL, DEV_LAPTOP_AGENT_TOKEN } from "@workspace/shared";
import { z } from "zod";

const AgentEnvSchema = z
	.object({
		/** `pnpm dev` sets it: report as the seeded "This laptop" to the local API. */
		OPS_AGENT_DEV: BooleanFlagEnvSchema,
		/** The API's public address, e.g. https://api.example.com. */
		OPS_API_URL: z.url().optional(),
		/** This server's agent token, issued when it was registered in the operations console. */
		OPS_AGENT_TOKEN: z.string().min(1).optional(),
	})
	.transform((env, context) => {
		const apiUrl = env.OPS_API_URL ?? (env.OPS_AGENT_DEV ? DEV_API_URL : undefined);
		const token = env.OPS_AGENT_TOKEN ?? (env.OPS_AGENT_DEV ? DEV_LAPTOP_AGENT_TOKEN : undefined);
		if (apiUrl === undefined || token === undefined) {
			context.addIssue({ code: "custom", message: "Set OPS_API_URL and OPS_AGENT_TOKEN (the token comes from registering the server in the operations console)" });
			return z.NEVER;
		}
		return { apiUrl, token };
	});

export type AgentEnv = z.output<typeof AgentEnvSchema>;

/** The validated configuration; a missing or malformed variable stops the agent with its name. */
export function loadAgentEnv(source: Readonly<Record<string, string | undefined>> = process.env): AgentEnv {
	return AgentEnvSchema.parse(source);
}
