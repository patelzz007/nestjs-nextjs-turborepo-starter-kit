import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { OPS_SAMPLE_INTERVAL_MS, type OpsAgentReportAck } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { OpsAgentTokenInvalidError } from "../../../domain/errors/operations.errors";
import { hashAgentToken } from "../../../domain/policies/agent-token.policy";
import { bucketStartOf } from "../../../domain/policies/history-window.policy";
import type { OperationsScope } from "../../operations-scope";
import { OPS_LIVE_STORE, type OpsLiveStore } from "../../ports/ops-live-store.port";
import { OPS_AGENT_REPORT_OPERATION, OPS_UNIT_OF_WORK } from "../../ports/operations.tokens";
import { RecordAgentReportCommand } from "./record-agent-report.command";

/**
 * Records one agent report. Never trusts the agent: the token must match a live server (by its
 * digest), the body was validated by the shared schema, and the sample's own clock is replaced by the
 * API's (an agent with a wrong clock cannot write into the past or the future). The live sample goes to
 * the live store; the finished minute (once a minute) to the history.
 */
@CommandHandler(RecordAgentReportCommand)
export class RecordAgentReportHandler implements ICommandHandler<RecordAgentReportCommand, OpsAgentReportAck> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(OPS_LIVE_STORE) private readonly live: OpsLiveStore,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute({ actor, token, report }: RecordAgentReportCommand): Promise<OpsAgentReportAck> {
		if (token === null) {
			throw new OpsAgentTokenInvalidError();
		}
		const now = this.clock.now();
		const serverId: string = await this.uow.runSystemOperation(OPS_AGENT_REPORT_OPERATION, actor, async (scope): Promise<string> => {
			const server = await scope.servers.findByTokenHash(hashAgentToken(token));
			if (server === null) {
				throw new OpsAgentTokenInvalidError();
			}
			await scope.servers.recordReport(server.id, { agentVersion: report.agentVersion, host: report.host, at: now });
			if (report.minute !== null) {
				// The minute that just ended, by the API's clock.
				const bucketStart = bucketStartOf(now - OPS_SAMPLE_INTERVAL_MS, "MINUTE");
				await scope.history.putServerPoint(server.id, "MINUTE", { ...report.minute, bucketStart });
			}
			return server.id;
		});
		await this.live.putServerLive(serverId, { ...report.live, sampledAt: now });
		return { nextReportInMs: OPS_SAMPLE_INTERVAL_MS };
	}
}
