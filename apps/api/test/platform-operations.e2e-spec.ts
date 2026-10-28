import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	API_VERSION_PREFIX,
	DEV_LAPTOP_AGENT_TOKEN,
	epochMs,
	OpsAgentReportAckSchema,
	OpsAlertListSchema,
	OpsBackupListSchema,
	OpsOverviewSchema,
	OpsServerCredentialsSchema,
	OpsServerDetailSchema,
	OpsServerHistorySchema,
	type OpsAgentReport,
} from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * The platform operations console (ADR 068) end to end: who may read and change what, the seeded
 * servers and their history, a server agent's report authenticated by its own token, and a server's
 * life — registered (token shown once), re-keyed (the old token stops working), removed.
 */

const GIB = 1_024 ** 3;

function report(): OpsAgentReport {
	const now = Date.now();
	return {
		agentVersion: "1.0.0",
		host: { hostname: "e2e-host", os: "Linux", kernel: "6.8", cpuModel: "E2E CPU", cpuCores: 2, memoryTotalBytes: 8 * GIB, uptimeSeconds: 60 },
		live: {
			sampledAt: epochMs(now),
			cpuPercent: 12,
			perCorePercent: [10, 14],
			stealPercent: null,
			iowaitPercent: null,
			load1: 0.5,
			load5: 0.5,
			load15: 0.5,
			memoryUsedBytes: 2 * GIB,
			memoryTotalBytes: 8 * GIB,
			swapUsedBytes: 0,
			swapTotalBytes: 0,
			disks: [{ mount: "/", usedBytes: 10 * GIB, totalBytes: 100 * GIB, inodesPercent: 5 }],
			diskReadBytesPerSec: 0,
			diskWriteBytesPerSec: 0,
			diskReadIops: null,
			diskWriteIops: null,
			netRxBytesPerSec: 0,
			netTxBytesPerSec: 0,
			tcpConnections: 3,
			openFiles: null,
			processCount: 100,
			topProcesses: [],
		},
		minute: null,
	};
}

describe("Platform operations console (e2e)", () => {
	let app: NestFastifyApplication;
	let superAdmin: LoginResult;
	let developer: LoginResult;

	beforeAll(async () => {
		app = await createE2eApp();
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		developer = await login(app, "developer@example.com", "Developer@123", "admin");
	});

	afterAll(async () => {
		await app.close();
	});

	function get(session: LoginResult, path: string): Promise<InjectResponse> {
		return app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}${path}`,
			headers: { authorization: `Bearer ${session.accessToken}`, "x-forwarded-for": uniqueClientIp() },
		});
	}

	function send(session: LoginResult, method: "POST" | "DELETE", path: string, payload?: object): Promise<InjectResponse> {
		return app.inject({
			method,
			url: `${API_VERSION_PREFIX}${path}`,
			headers: mutationHeaders({ authorization: `Bearer ${session.accessToken}`, "x-forwarded-for": uniqueClientIp() }),
			...(payload === undefined ? {} : { payload }),
		});
	}

	function agentReport(token: string | null): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/operations/agent/report`,
			headers: { "x-forwarded-for": uniqueClientIp(), ...(token === null ? {} : { authorization: `Bearer ${token}` }) },
			payload: report(),
		});
	}

	it("shows the seeded servers with their spec, and never the removed one", async () => {
		const response = await get(superAdmin, "/admin/operations/overview");
		expect(response.statusCode, response.body).toBe(200);
		const { servers } = parseSuccessEnvelope(response, OpsOverviewSchema).data;
		const names = servers.map((server) => server.name);

		expect(names).toContain("This laptop");
		expect(names).toContain("web-01");
		expect(names).not.toContain("old-worker");
		const laptop = servers.find((server) => server.name === "This laptop");
		expect(laptop?.cpuCores).toBeGreaterThan(0);
		expect(laptop?.memoryTotalBytes).toBeGreaterThan(0);
	});

	it("serves a server's history at the range's resolution", async () => {
		const overview = parseSuccessEnvelope(await get(superAdmin, "/admin/operations/overview"), OpsOverviewSchema).data;
		const web = overview.servers.find((server) => server.name === "web-01");
		expect(web).toBeDefined();

		const day = parseSuccessEnvelope(await get(superAdmin, `/admin/operations/servers/${web?.id ?? ""}/history?range=24h`), OpsServerHistorySchema).data;
		const month = parseSuccessEnvelope(await get(superAdmin, `/admin/operations/servers/${web?.id ?? ""}/history?range=30d`), OpsServerHistorySchema).data;

		expect(day.resolution).toBe("MINUTE");
		expect(day.points.length).toBeGreaterThan(0);
		expect(month.resolution).toBe("HOUR");
		expect(month.points.length).toBeGreaterThan(day.points.length / 60);
	});

	it("lets a Platform Developer watch servers and alerts, but not backups", async () => {
		expect((await get(developer, "/admin/operations/overview")).statusCode).toBe(200);
		const alerts = await get(developer, "/admin/operations/alerts?status=ALL");
		expect(alerts.statusCode, alerts.body).toBe(200);
		expect(parseSuccessEnvelope(alerts, OpsAlertListSchema).data.alerts.length).toBeGreaterThan(0);
		expect((await get(developer, "/admin/operations/backups")).statusCode).toBe(403);
	});

	it("shows the SuperAdmin the backups and their schedule", async () => {
		const response = await get(superAdmin, "/admin/operations/backups");
		expect(response.statusCode, response.body).toBe(200);
		const list = parseSuccessEnvelope(response, OpsBackupListSchema).data;

		expect(list.backups.length).toBeGreaterThan(0);
		expect(list.schedule.retentionDays).toBeGreaterThan(0);
	});

	it("refuses the console to a merchant", async () => {
		const merchant = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		const response = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/admin/operations/overview`,
			headers: { cookie: `merchantAccessToken=${merchant.accessToken}`, "x-client-type": "merchant", "x-forwarded-for": uniqueClientIp() },
		});

		expect([401, 403]).toContain(response.statusCode);
	});

	it("accepts a report from an agent with its server's token, and refuses any other", async () => {
		const accepted = await agentReport(DEV_LAPTOP_AGENT_TOKEN);
		expect(accepted.statusCode, accepted.body).toBe(200);
		expect(parseSuccessEnvelope(accepted, OpsAgentReportAckSchema).data.nextReportInMs).toBeGreaterThan(0);

		expect((await agentReport("opsagent_not-a-real-token")).statusCode).toBe(401);
		expect((await agentReport(null)).statusCode).toBe(401);
	});

	it("records the reporting server's facts and last report", async () => {
		const before = Date.now();
		expect((await agentReport(DEV_LAPTOP_AGENT_TOKEN)).statusCode).toBe(200);
		const { servers } = parseSuccessEnvelope(await get(superAdmin, "/admin/operations/overview"), OpsOverviewSchema).data;
		const laptop = servers.find((server) => server.name === "This laptop");

		expect(laptop?.hostname).toBe("e2e-host");
		expect(laptop?.lastSeenAt).toBeGreaterThanOrEqual(before);
	});

	it("registers a server, re-keys it and removes it — each token working only while it is current", async () => {
		const name = `e2e-${randomUUID().slice(0, 8)}`;
		const registered = await send(superAdmin, "POST", "/admin/operations/servers", { name, provider: "HETZNER", providerServerId: "40112299" });
		expect(registered.statusCode, registered.body).toBe(201);
		const first = parseSuccessEnvelope(registered, OpsServerCredentialsSchema).data;
		expect(first.agentToken.startsWith("opsagent_")).toBe(true);
		expect(first.installCommand).toContain(first.agentToken);
		expect((await agentReport(first.agentToken)).statusCode).toBe(200);

		const rotated = await send(superAdmin, "POST", `/admin/operations/servers/${first.server.id}/token`);
		expect(rotated.statusCode, rotated.body).toBe(201);
		const second = parseSuccessEnvelope(rotated, OpsServerCredentialsSchema).data;
		expect((await agentReport(first.agentToken)).statusCode).toBe(401);
		expect((await agentReport(second.agentToken)).statusCode).toBe(200);

		const detail = parseSuccessEnvelope(await get(superAdmin, `/admin/operations/servers/${first.server.id}`), OpsServerDetailSchema).data;
		expect(detail.provider).toBe("HETZNER");

		expect((await send(superAdmin, "DELETE", `/admin/operations/servers/${first.server.id}`)).statusCode).toBe(200);
		expect((await agentReport(second.agentToken)).statusCode).toBe(401);
		expect((await get(superAdmin, `/admin/operations/servers/${first.server.id}`)).statusCode).toBe(404);
	});

	it("serves a backup's file only for a valid one-time ticket", async () => {
		const { backups } = parseSuccessEnvelope(await get(superAdmin, "/admin/operations/backups"), OpsBackupListSchema).data;
		const [backup] = backups;
		expect(backup).toBeDefined();

		const response = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/operations/backups/${backup?.id ?? ""}/file?ticket=not-a-ticket`,
			headers: { "x-forwarded-for": uniqueClientIp() },
		});

		expect(response.statusCode).toBe(404);
	});

	it("does not let a Platform Developer register servers", async () => {
		const response = await send(developer, "POST", "/admin/operations/servers", { name: `e2e-${randomUUID().slice(0, 8)}`, provider: "OTHER", providerServerId: null });

		expect(response.statusCode).toBe(403);
	});
});
