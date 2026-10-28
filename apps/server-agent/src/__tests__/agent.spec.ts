import { DEV_API_URL, type JsonValue, OPS_SAMPLE_INTERVAL_MS, OpsAgentReportSchema, type OpsAgentReport } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { type AgentLog, type ReportTransport, ServerAgent } from "../agent";
import { FakeMachine, liveSample } from "./fixtures";

const MINUTE = 60_000;
const OK = 200;

interface Sent {
	readonly url: string;
	readonly authorization: string | undefined;
	readonly report: OpsAgentReport;
}

class RecordingLog implements AgentLog {
	public readonly warnings: string[] = [];

	public info(): void {
		// The tests read warnings only.
	}

	public warn(message: string): void {
		this.warnings.push(message);
	}
}

/** A transport that records what it was sent and answers the queued statuses (then 200). */
/** The API's success envelope around an acknowledgement, as the report route answers. */
function envelope(nextReportInMs: number): JsonValue {
	return { success: true, data: { nextReportInMs }, meta: { correlationId: "test", timestamp: 0 } };
}

function transport(statuses: number[], ack: JsonValue = envelope(OPS_SAMPLE_INTERVAL_MS)): { readonly send: ReportTransport; readonly sent: Sent[] } {
	const sent: Sent[] = [];
	const send: ReportTransport = (url, init) => {
		sent.push({ url, authorization: init.headers.Authorization, report: OpsAgentReportSchema.parse(JSON.parse(init.body)) });
		const status: number = statuses.shift() ?? OK;
		return Promise.resolve({ status, json: (): Promise<JsonValue> => Promise.resolve(ack) });
	};
	return { send, sent };
}

function agentWith(send: ReportTransport, clock: { now: number }, log: AgentLog = new RecordingLog()): ServerAgent {
	return new ServerAgent({
		machine: new FakeMachine([liveSample({ cpuPercent: 10 }), liveSample({ cpuPercent: 30 }), liveSample({ cpuPercent: 50 })]),
		send,
		apiUrl: `${DEV_API_URL}/`,
		token: "opsagent_t",
		log,
		now: () => clock.now,
	});
}

describe("ServerAgent", () => {
	it("reports the live sample with its bearer token to the report route", async () => {
		const { send, sent } = transport([]);
		const agent = agentWith(send, { now: 0 });

		expect(await agent.tick()).toBe(true);
		const [first] = sent;
		expect(first?.url).toBe(`${DEV_API_URL}/api/v1/operations/agent/report`);
		expect(first?.authorization).toBe("Bearer opsagent_t");
		expect(first?.report.minute).toBeNull();
		expect(first?.report.live.cpuPercent).toBe(10);
	});

	it("sends the finished minute once the clock moves into the next one", async () => {
		const { send, sent } = transport([]);
		const clock = { now: 0 };
		const agent = agentWith(send, clock);

		await agent.tick();
		clock.now = 10_000;
		await agent.tick();
		clock.now = MINUTE;
		await agent.tick();

		const [, , third] = sent;
		expect(third?.report.minute).toMatchObject({ bucketStart: 0, cpuPercentAvg: 20, cpuPercentMax: 30 });
	});

	it("keeps the finished minute for the next report when the API did not take it", async () => {
		const { send, sent } = transport([OK, 503]);
		const clock = { now: 0 };
		const log = new RecordingLog();
		const agent = agentWith(send, clock, log);

		await agent.tick();
		clock.now = MINUTE;
		expect(await agent.tick()).toBe(false);
		clock.now = MINUTE + 10_000;
		expect(await agent.tick()).toBe(true);

		const [, second, third] = sent;
		expect(second?.report.minute?.bucketStart).toBe(0);
		expect(third?.report.minute?.bucketStart).toBe(0);
		expect(log.warnings.join()).toContain("503");
	});

	it("says to rotate the token when the API refuses it", async () => {
		const { send } = transport([401]);
		const log = new RecordingLog();

		expect(await agentWith(send, { now: 0 }, log).tick()).toBe(false);
		expect(log.warnings.join()).toContain("rotate it");
	});

	it("follows the pace the API asks for", async () => {
		const { send } = transport([], envelope(30_000));
		const agent = agentWith(send, { now: 0 });

		expect(agent.delayMs).toBe(OPS_SAMPLE_INTERVAL_MS);
		await agent.tick();
		expect(agent.delayMs).toBe(30_000);
	});

	it("never throws: a network failure is logged and retried", async () => {
		const log = new RecordingLog();
		const send: ReportTransport = () => Promise.reject(new Error("ECONNREFUSED"));

		expect(await agentWith(send, { now: 0 }, log).tick()).toBe(false);
		expect(log.warnings.join()).toContain("ECONNREFUSED");
	});
});
