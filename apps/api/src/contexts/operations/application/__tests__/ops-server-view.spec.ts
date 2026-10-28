import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import { actingUserIdOf, agentInstallCommand, toServerDetail, toServerSummary } from "../services/ops-server-view";
import { anonymousActor, serverRecord, superAdminActor } from "./fakes/operations.fakes";

const MINUTE = 60_000;
const NOW = epochMs(100 * MINUTE);

describe("toServerSummary", () => {
	it("carries the machine's spec and reads its health from the last report", () => {
		const server = serverRecord({ cpuModel: "AMD", cpuCores: 4, memoryTotalBytes: 8, uptimeSeconds: 60, lastSeenAt: epochMs(NOW - MINUTE) });

		expect(toServerSummary(server, null, 2, NOW, 3)).toMatchObject({
			health: "UP",
			cpuModel: "AMD",
			cpuCores: 4,
			memoryTotalBytes: 8,
			uptimeSeconds: 60,
			openAlerts: 2,
			live: null,
		});
		expect(toServerSummary({ ...server, lastSeenAt: epochMs(NOW - 4 * MINUTE) }, null, 0, NOW, 3).health).toBe("DOWN");
		expect(toServerSummary({ ...server, lastSeenAt: null }, null, 0, NOW, 3).health).toBe("UNKNOWN");
	});
});

describe("toServerDetail", () => {
	it("adds the agent, token prefix, registration time and the provider's view", () => {
		const detail = toServerDetail(serverRecord({ kernel: "6.8", agentVersion: "1.0.0" }), {
			live: null,
			openAlerts: 0,
			now: NOW,
			silentAfterMinutes: 3,
			cloud: null,
			cloudError: "No DIGITALOCEAN API token is configured on this deployment",
		});

		expect(detail).toMatchObject({ kernel: "6.8", agentVersion: "1.0.0", tokenPrefix: "opsagent_abcdefg", registeredAt: 0, cloud: null });
		expect(detail.cloudError).toContain("DIGITALOCEAN");
	});
});

describe("agentInstallCommand", () => {
	it("starts the agent's Compose service with the API address and the token", () => {
		expect(agentInstallCommand("https://api.example.com", "opsagent_x")).toBe(
			"OPS_API_URL=https://api.example.com OPS_AGENT_TOKEN=opsagent_x docker compose --profile agent up -d server-agent",
		);
	});
});

describe("actingUserIdOf", () => {
	it("is the signed-in user, and refuses anyone else", () => {
		expect(actingUserIdOf(superAdminActor("user-1"))).toBe("user-1");
		expect(() => actingUserIdOf(anonymousActor())).toThrow(AuthenticationError);
	});
});
