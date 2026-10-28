import { DEV_API_URL, DEV_LAPTOP_AGENT_TOKEN } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { loadAgentEnv } from "../env";

describe("loadAgentEnv", () => {
	it("reads the API address and token", () => {
		expect(loadAgentEnv({ OPS_API_URL: "https://api.example.com", OPS_AGENT_TOKEN: "opsagent_x" })).toEqual({ apiUrl: "https://api.example.com", token: "opsagent_x" });
	});

	it("reports as the seeded laptop to the local API in development", () => {
		expect(loadAgentEnv({ OPS_AGENT_DEV: "true" })).toEqual({ apiUrl: DEV_API_URL, token: DEV_LAPTOP_AGENT_TOKEN });
	});

	it("lets development override the address", () => {
		expect(loadAgentEnv({ OPS_AGENT_DEV: "true", OPS_API_URL: "http://localhost:8098" }).apiUrl).toBe("http://localhost:8098");
	});

	it("refuses to start without an address and token outside development", () => {
		expect(() => loadAgentEnv({})).toThrow(/OPS_API_URL and OPS_AGENT_TOKEN/);
		expect(() => loadAgentEnv({ OPS_API_URL: "not a url", OPS_AGENT_TOKEN: "x" })).toThrow();
	});
});
