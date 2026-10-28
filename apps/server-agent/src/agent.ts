// ============================================
// agent.ts — one report every 10 seconds, and the finished minute once a minute
// ============================================
// Single Responsibility: the agent loop. Reading the machine (`Machine`) and talking to the API
// (`ReportTransport`) are injected (Dependency Inversion), so the loop is tested without either.
// A report the API did not take (network, restart) keeps its finished minute for the next attempt.

import {
	apiPath,
	createApiSuccessEnvelopeSchema,
	type JsonValue,
	OPS_SAMPLE_INTERVAL_MS,
	OpsAgentReportAckSchema,
	OpsAgentReportSchema,
	type OpsAgentReport,
	type OpsServerLive,
	type OpsServerPoint,
} from "@workspace/shared";

import type { Machine } from "./machine";
import { minuteOf, minutePoint } from "./minute";

/** The agent's version, reported with every sample. */
export const AGENT_VERSION = "1.0.0";

/** Sends one report; resolves the API's answer status and body. */
export type ReportTransport = (
	url: string,
	init: { readonly method: "POST"; readonly headers: Readonly<Record<string, string>>; readonly body: string },
) => Promise<{ readonly status: number; json(): Promise<JsonValue> }>;

export interface AgentLog {
	info(message: string): void;
	warn(message: string): void;
}

const UNAUTHORIZED = 401;
/** The API answers in its standard success envelope (`{ success, data, meta }`). */
const AckEnvelopeSchema = createApiSuccessEnvelopeSchema(OpsAgentReportAckSchema);

export class ServerAgent {
	private _samples: OpsServerLive[] = [];
	private _currentMinute: number | null = null;
	private _pendingMinute: OpsServerPoint | null = null;
	private _nextReportInMs: number = OPS_SAMPLE_INTERVAL_MS;

	public constructor(
		private readonly _deps: {
			readonly machine: Machine;
			readonly send: ReportTransport;
			readonly apiUrl: string;
			readonly token: string;
			readonly log: AgentLog;
			readonly now: () => number;
		},
	) {}

	/** How long to wait before the next tick (the API may ask for another pace). */
	public get delayMs(): number {
		return this._nextReportInMs;
	}

	/** One tick: sample, close the minute if it changed, report. Never throws: a failure is logged and retried next tick. */
	public async tick(): Promise<boolean> {
		try {
			const live: OpsServerLive = await this._deps.machine.sample();
			const minute: number = minuteOf(this._deps.now());
			if (this._currentMinute !== null && minute !== this._currentMinute) {
				this._pendingMinute = minutePoint(this._samples, this._currentMinute) ?? this._pendingMinute;
				this._samples = [];
			}
			this._currentMinute = minute;
			this._samples.push(live);
			const report: OpsAgentReport = OpsAgentReportSchema.parse({ agentVersion: AGENT_VERSION, host: await this._deps.machine.facts(), live, minute: this._pendingMinute });
			const response = await this._deps.send(`${this._deps.apiUrl.replace(/\/$/, "")}${apiPath("/operations")}/agent/report`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${this._deps.token}` },
				body: JSON.stringify(report),
			});
			if (response.status === UNAUTHORIZED) {
				this._deps.log.warn("The API refused this agent's token: rotate it in the operations console and restart the agent with the new one.");
				return false;
			}
			const okStatus = 200;
			if (response.status !== okStatus) {
				this._deps.log.warn(`The API answered ${String(response.status)}; retrying in ${String(this._nextReportInMs / 1_000)} s.`);
				return false;
			}
			const ack = AckEnvelopeSchema.safeParse(await response.json());
			this._pendingMinute = null;
			if (ack.success) {
				this._nextReportInMs = ack.data.data.nextReportInMs;
			}
			return true;
		} catch (error) {
			this._deps.log.warn(`Report failed: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}
}
