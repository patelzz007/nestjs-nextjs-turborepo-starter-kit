import { Command } from "@nestjs/cqrs";
import type { OpsAgentReport, OpsAgentReportAck } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /operations/agent/report`: one server agent's report, with the bearer token it presented. */
export class RecordAgentReportCommand extends Command<OpsAgentReportAck> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly token: string | null,
		public readonly report: OpsAgentReport,
	) {
		super();
	}
}
