import { epochMs, OPS_SAMPLE_INTERVAL_MS, type OpsAgentReport, type OpsAlertSettings } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { parseApiConfig } from "../../../../config/api-config";
import { TEST_API_ENV } from "../../../../../test/support/test-api-env";
import { OpsAgentTokenInvalidError, OpsServerNameTakenError, OpsServerNotFoundError } from "../../domain/errors/operations.errors";
import { hashAgentToken } from "../../domain/policies/agent-token.policy";
import { RecordAgentReportCommand } from "../commands/record-agent-report/record-agent-report.command";
import { RecordAgentReportHandler } from "../commands/record-agent-report/record-agent-report.handler";
import { RegisterOpsServerCommand } from "../commands/register-ops-server/register-ops-server.command";
import { RegisterOpsServerHandler } from "../commands/register-ops-server/register-ops-server.handler";
import { RevokeOpsServerCommand } from "../commands/revoke-ops-server/revoke-ops-server.command";
import { RevokeOpsServerHandler } from "../commands/revoke-ops-server/revoke-ops-server.handler";
import { RotateOpsServerTokenCommand } from "../commands/rotate-ops-server-token/rotate-ops-server-token.command";
import { RotateOpsServerTokenHandler } from "../commands/rotate-ops-server-token/rotate-ops-server-token.handler";
import { UpdateOpsAlertSettingsCommand } from "../commands/update-ops-alert-settings/update-ops-alert-settings.command";
import { UpdateOpsAlertSettingsHandler } from "../commands/update-ops-alert-settings/update-ops-alert-settings.handler";
import { anonymousActor, FakeClock, FakeLiveStore, FakeOperationsUnitOfWork, serverRecord, superAdminActor } from "./fakes/operations.fakes";

const GIB = 1_024 ** 3;
const NOW = 1_793_000_000_000;
const TOKEN = "opsagent_test-token";

function config(): TypedConfigService {
	return new TypedConfigService(parseApiConfig(TEST_API_ENV));
}

function report(minute: boolean): OpsAgentReport {
	return {
		agentVersion: "1.0.0",
		host: { hostname: "web-01", os: "Ubuntu", kernel: "6.8", cpuModel: "AMD", cpuCores: 4, memoryTotalBytes: 8 * GIB, uptimeSeconds: 60 },
		live: {
			sampledAt: epochMs(0),
			cpuPercent: 10,
			perCorePercent: [10],
			stealPercent: null,
			iowaitPercent: null,
			load1: 0,
			load5: 0,
			load15: 0,
			memoryUsedBytes: GIB,
			memoryTotalBytes: 8 * GIB,
			swapUsedBytes: 0,
			swapTotalBytes: 0,
			disks: [],
			diskReadBytesPerSec: 0,
			diskWriteBytesPerSec: 0,
			diskReadIops: null,
			diskWriteIops: null,
			netRxBytesPerSec: 0,
			netTxBytesPerSec: 0,
			tcpConnections: 0,
			openFiles: null,
			processCount: 1,
			topProcesses: [],
		},
		minute: minute
			? {
					bucketStart: epochMs(0),
					cpuPercentAvg: 10,
					cpuPercentMax: 20,
					stealPercentAvg: null,
					iowaitPercentAvg: null,
					load1Avg: 0,
					memoryUsedBytes: GIB,
					memoryTotalBytes: 8 * GIB,
					memoryPercentMax: 12.5,
					swapUsedBytes: 0,
					diskUsedBytes: 0,
					diskTotalBytes: 0,
					diskPercentMax: 0,
					inodesPercentMax: null,
					diskReadBytesPerSec: 0,
					diskWriteBytesPerSec: 0,
					netRxBytesPerSec: 0,
					netTxBytesPerSec: 0,
					tcpConnections: 0,
					processCount: 1,
				}
			: null,
	};
}

describe("RecordAgentReportHandler", () => {
	function setup(): { readonly uow: FakeOperationsUnitOfWork; readonly live: FakeLiveStore; readonly handler: RecordAgentReportHandler } {
		const uow = new FakeOperationsUnitOfWork();
		uow.servers.seed(serverRecord(), hashAgentToken(TOKEN));
		const live = new FakeLiveStore();
		return { uow, live, handler: new RecordAgentReportHandler(uow, live, new FakeClock(NOW)) };
	}

	it("records the host facts and the live sample on the API's clock, and sets the pace", async () => {
		const { uow, live, handler } = setup();

		const ack = await handler.execute(new RecordAgentReportCommand(anonymousActor(), TOKEN, report(false)));

		expect(ack).toEqual({ nextReportInMs: OPS_SAMPLE_INTERVAL_MS });
		const server = await uow.servers.find(serverRecord().id);
		expect(server).toMatchObject({ hostname: "web-01", cpuCores: 4, lastSeenAt: NOW });
		const samples = await live.serverLive([serverRecord().id]);
		expect(samples.get(serverRecord().id)?.sampledAt).toBe(NOW);
		expect(uow.history.written).toEqual([]);
		expect(uow.operations).toEqual(["operations.agent.report"]);
	});

	it("files the finished minute under the minute that just ended by the API's clock", async () => {
		const { uow, handler } = setup();

		await handler.execute(new RecordAgentReportCommand(anonymousActor(), TOKEN, report(true)));

		const [written] = uow.history.written;
		expect(written?.resolution).toBe("MINUTE");
		expect(written?.point.bucketStart).toBe(Math.floor((NOW - OPS_SAMPLE_INTERVAL_MS) / 60_000) * 60_000);
	});

	it("refuses a missing or unknown token without writing anything", async () => {
		const { uow, handler } = setup();

		await expect(handler.execute(new RecordAgentReportCommand(anonymousActor(), null, report(true)))).rejects.toBeInstanceOf(OpsAgentTokenInvalidError);
		await expect(handler.execute(new RecordAgentReportCommand(anonymousActor(), "opsagent_wrong", report(true)))).rejects.toBeInstanceOf(OpsAgentTokenInvalidError);
		expect(uow.history.written).toEqual([]);
	});
});

describe("server lifecycle handlers", () => {
	function setup(): { readonly uow: FakeOperationsUnitOfWork; readonly clock: FakeClock } {
		return { uow: new FakeOperationsUnitOfWork(), clock: new FakeClock(NOW) };
	}

	it("registers a server with a fresh token shown once, stored only as its digest", async () => {
		const { uow, clock } = setup();

		const credentials = await new RegisterOpsServerHandler(uow, clock, config()).execute(
			new RegisterOpsServerCommand(superAdminActor(), { name: "web-02", provider: "VULTR", providerServerId: "abc" }),
		);

		expect(credentials.agentToken.startsWith("opsagent_")).toBe(true);
		expect(credentials.installCommand).toContain(`OPS_AGENT_TOKEN=${credentials.agentToken}`);
		expect(credentials.server).toMatchObject({ name: "web-02", provider: "VULTR", health: "UNKNOWN" });
		expect((await uow.servers.findByTokenHash(hashAgentToken(credentials.agentToken)))?.id).toBe(credentials.server.id);
	});

	it("refuses a name another live server has", async () => {
		const { uow, clock } = setup();
		uow.servers.seed(serverRecord({ name: "web-01" }), "digest");

		await expect(
			new RegisterOpsServerHandler(uow, clock, config()).execute(
				new RegisterOpsServerCommand(superAdminActor(), { name: "web-01", provider: "OTHER", providerServerId: null }),
			),
		).rejects.toBeInstanceOf(OpsServerNameTakenError);
	});

	it("rotates a token so only the new one identifies the server", async () => {
		const { uow, clock } = setup();
		uow.servers.seed(serverRecord(), hashAgentToken(TOKEN));

		const rotated = await new RotateOpsServerTokenHandler(uow, clock, config()).execute(new RotateOpsServerTokenCommand(superAdminActor(), serverRecord().id));

		expect(await uow.servers.findByTokenHash(hashAgentToken(TOKEN))).toBeNull();
		expect((await uow.servers.findByTokenHash(hashAgentToken(rotated.agentToken)))?.id).toBe(serverRecord().id);
	});

	it("removes a server, and refuses an unknown one", async () => {
		const { uow, clock } = setup();
		uow.servers.seed(serverRecord(), hashAgentToken(TOKEN));
		const revoke = new RevokeOpsServerHandler(uow, clock);

		expect(await revoke.execute(new RevokeOpsServerCommand(superAdminActor(), serverRecord().id))).toEqual({ success: true });
		expect(await uow.servers.find(serverRecord().id)).toBeNull();
		await expect(revoke.execute(new RevokeOpsServerCommand(superAdminActor(), serverRecord().id))).rejects.toBeInstanceOf(OpsServerNotFoundError);
	});

	it("saves the alert settings", async () => {
		const { uow } = setup();
		const settings: OpsAlertSettings = {
			cpuPercent: 80,
			cpuSustainMinutes: 10,
			memoryPercent: 85,
			diskPercent: 80,
			silentAfterMinutes: 5,
			tlsWarnDays: 21,
			extraRecipients: ["ops@example.com"],
		};

		expect(await new UpdateOpsAlertSettingsHandler(uow).execute(new UpdateOpsAlertSettingsCommand(superAdminActor(), settings))).toEqual(settings);
		expect((await uow.settings.get()).alerts).toEqual(settings);
	});
});
