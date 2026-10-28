// The server agent's entry point: load the configuration, then report until stopped.
//   OPS_API_URL=… OPS_AGENT_TOKEN=… pnpm --filter @workspace/server-agent start

import { JsonValueSchema, type JsonValue } from "@workspace/shared";

import { loadAgentEnv } from "./env";
import { AGENT_VERSION, ServerAgent } from "./agent";
import { SystemInformationMachine } from "./machine";

const env = loadAgentEnv();
const agent = new ServerAgent({
	machine: new SystemInformationMachine(),
	send: async (url, init): Promise<{ readonly status: number; json(): Promise<JsonValue> }> => {
		const response = await fetch(url, init);
		return { status: response.status, json: async (): Promise<JsonValue> => JsonValueSchema.parse(await response.json()) };
	},
	apiUrl: env.apiUrl,
	token: env.token,
	log: {
		info: (message: string): void => {
			console.log(message);
		},
		warn: (message: string): void => {
			console.warn(message);
		},
	},
	now: Date.now,
});

let timer: NodeJS.Timeout | undefined;
let stopped = false;

async function loop(): Promise<void> {
	if (stopped) {
		return;
	}
	await agent.tick();
	timer = setTimeout((): void => {
		void loop();
	}, agent.delayMs);
}

function stop(): void {
	stopped = true;
	clearTimeout(timer);
	console.log("Server agent stopped.");
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
console.log(`Server agent ${AGENT_VERSION} reporting to ${env.apiUrl}`);
void loop();
