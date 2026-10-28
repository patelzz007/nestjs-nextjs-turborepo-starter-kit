import { epochMs, type OpsServerDetail, type OpsServerLive, type OpsServerPoint, type OpsServerSummary } from "@workspace/shared";
import { fireEvent, screen } from "expo-router/testing-library";

import { fail, ok, stubApi } from "../../../../../test/api-stub";
import { createTestRuntime, renderInApp } from "../../../../../test/app-harness";
import { testAccessToken } from "../../../../../test/jwt";
import ServerRoute from "../../../../app/(app)/settings/server";
import ServersRoute from "../../../../app/(app)/settings/servers";

const GIB = 1_024 ** 3;
const SERVER_ID = "3f6c2a1e-9b8d-4c7e-a5f4-1d2e3c4b5a69";
const NOW = 1_793_000_000_000;

const LIVE: OpsServerLive = {
	sampledAt: epochMs(NOW),
	cpuPercent: 42,
	perCorePercent: [40, 44],
	stealPercent: null,
	iowaitPercent: null,
	load1: 1.25,
	load5: 1,
	load15: 1,
	memoryUsedBytes: 6 * GIB,
	memoryTotalBytes: 8 * GIB,
	swapUsedBytes: GIB,
	swapTotalBytes: 2 * GIB,
	disks: [
		{ mount: "/", usedBytes: 100 * GIB, totalBytes: 160 * GIB, inodesPercent: 10 },
		{ mount: "/data", usedBytes: 20 * GIB, totalBytes: 80 * GIB, inodesPercent: 2 },
	],
	diskReadBytesPerSec: 0,
	diskWriteBytesPerSec: 0,
	diskReadIops: null,
	diskWriteIops: null,
	netRxBytesPerSec: 0,
	netTxBytesPerSec: 0,
	tcpConnections: 10,
	openFiles: null,
	processCount: 200,
	topProcesses: [],
};

const SUMMARY: OpsServerSummary = {
	id: SERVER_ID,
	name: "web-01",
	provider: "DIGITALOCEAN",
	providerServerId: "512345678",
	health: "UP",
	hostname: "web-01",
	os: "Ubuntu 24.04",
	cpuModel: "DO-Premium-AMD",
	cpuCores: 4,
	memoryTotalBytes: 8 * GIB,
	uptimeSeconds: 3 * 86_400,
	lastSeenAt: epochMs(NOW),
	live: LIVE,
	openAlerts: 0,
};

const DETAIL: OpsServerDetail = {
	...SUMMARY,
	kernel: "Linux 6.8",
	agentVersion: "1.0.0",
	tokenPrefix: "opsagent_abcdefg",
	registeredAt: epochMs(NOW - 86_400_000),
	cloud: null,
	cloudError: null,
};

function point(index: number): OpsServerPoint {
	return {
		bucketStart: epochMs(NOW - (60 - index) * 60_000),
		cpuPercentAvg: 20 + index,
		cpuPercentMax: 30 + index,
		stealPercentAvg: null,
		iowaitPercentAvg: null,
		load1Avg: 1,
		memoryUsedBytes: 4 * GIB,
		memoryTotalBytes: 8 * GIB,
		memoryPercentMax: 50,
		swapUsedBytes: 0,
		diskUsedBytes: 100 * GIB,
		diskTotalBytes: 160 * GIB,
		diskPercentMax: 63,
		inodesPercentMax: null,
		diskReadBytesPerSec: 0,
		diskWriteBytesPerSec: 0,
		netRxBytesPerSec: 0,
		netTxBytesPerSec: 0,
		tcpConnections: 1,
		processCount: 1,
	};
}

function overview(servers: readonly OpsServerSummary[]): ReturnType<typeof ok> {
	return ok({ servers: [...servers], instances: [], dependencies: [], openAlerts: [], cloudProviders: [] });
}

async function render(url: string): Promise<void> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, { "settings/servers": ServersRoute, "settings/server": ServerRoute }, url);
}

describe("Servers (mobile)", () => {
	it("lists each server with its health, spec and usage now", async () => {
		stubApi({ "GET /admin/operations/overview": overview([SUMMARY]) });
		await render("/settings/servers");

		expect(await screen.findByText("web-01")).toBeTruthy();
		expect(screen.getByText("DigitalOcean · web-01")).toBeTruthy();
		expect(screen.getByText("DO-Premium-AMD · 4 cores · 8.0 GB RAM · 240 GB storage")).toBeTruthy();
		expect(screen.getByText("6.0 GB of 8.0 GB")).toBeTruthy();
		expect(screen.getByText("120 GB of 240 GB")).toBeTruthy();
	});

	it("says when a server's agent has gone quiet", async () => {
		stubApi({ "GET /admin/operations/overview": overview([{ ...SUMMARY, live: null, health: "DOWN" }]) });
		await render("/settings/servers");

		expect(await screen.findByText(/has not reported in the last 30 seconds/)).toBeTruthy();
	});

	it("shows an empty state when no server is registered", async () => {
		stubApi({ "GET /admin/operations/overview": overview([]) });
		await render("/settings/servers");

		expect(await screen.findByText("No servers yet")).toBeTruthy();
	});

	it("offers a retry when the servers cannot be loaded", async () => {
		stubApi({ "GET /admin/operations/overview": fail(403, "FORBIDDEN", "Not allowed") });
		await render("/settings/servers");

		expect(await screen.findByText("The servers could not be loaded.")).toBeTruthy();
	});

	it("shows a server's machine spec, disks and history", async () => {
		const api = stubApi({
			"GET /admin/operations/overview": overview([SUMMARY]),
			[`GET /admin/operations/servers/${SERVER_ID}`]: ok(DETAIL),
			[`GET /admin/operations/servers/${SERVER_ID}/history`]: ok({
				range: "24h",
				resolution: "MINUTE",
				from: NOW - 86_400_000,
				to: NOW,
				points: Array.from({ length: 30 }, (_unused, index) => point(index)),
			}),
		});
		await render(`/settings/server?serverId=${SERVER_ID}`);

		expect(await screen.findByText("Machine")).toBeTruthy();
		expect(screen.getByText("6.0 GB used · 2.0 GB free")).toBeTruthy();
		expect(screen.getByText("120 GB used · 120 GB free")).toBeTruthy();
		expect(screen.getByText("1.0 GB used · 1.0 GB free")).toBeTruthy();
		expect(screen.getByText("/data")).toBeTruthy();
		expect(await screen.findByTestId("server-history")).toBeTruthy();
		expect(api.callsTo(`GET /admin/operations/servers/${SERVER_ID}/history`).at(0)?.path).toContain("range=24h");
	});

	it("opens a server from the list", async () => {
		stubApi({
			"GET /admin/operations/overview": overview([SUMMARY]),
			[`GET /admin/operations/servers/${SERVER_ID}`]: ok(DETAIL),
			[`GET /admin/operations/servers/${SERVER_ID}/history`]: ok({ range: "24h", resolution: "MINUTE", from: NOW - 86_400_000, to: NOW, points: [] }),
		});
		await render("/settings/servers");
		await fireEvent.press(await screen.findByLabelText("web-01, Up. Open its history"));

		expect(await screen.findByText("Machine")).toBeTruthy();
		expect(await screen.findByText("No history in this range yet.")).toBeTruthy();
	});

	it("refuses a server link without a valid id", async () => {
		stubApi({});
		await render("/settings/server?serverId=nope");

		expect(await screen.findByText("This server could not be opened")).toBeTruthy();
	});
});
