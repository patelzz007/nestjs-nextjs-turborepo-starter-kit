// ============================================
// presentation/http/operations-agent.controller.ts — where a server agent reports (ADR 068)
// ============================================
// Not a session route: the agent authenticates with its server's own bearer token, checked by the
// command against the stored digest. Like the health probes, these pushes (one every 10 s per
// server) are left out of the HTTP audit log — ADR 068, exception 1 — while the server's last-seen
// time is recorded, and registering, re-keying and removing servers are audited.

import { Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiPath, OpsAgentReportAckSchema, OpsAgentReportSchema, type OpsAgentReport, type OpsAgentReportAck } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { RecordAgentReportCommand } from "../../application/commands/record-agent-report/record-agent-report.command";
import { OPS_AGENT_REPORT_OPERATION } from "../../application/ports/operations.tokens";
import { bearerToken } from "../../domain/policies/agent-token.policy";

@ApiTags("Operations")
@Controller(apiPath("/operations"))
export class OperationsAgentController {
	public constructor(private readonly commandBus: CommandBus) {}

	@Public()
	@PublicOperation(OPS_AGENT_REPORT_OPERATION)
	@SkipMutationIntent()
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Post("agent/report")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "A server agent's report (bearer: the server's agent token)" })
	@ZodResponse(OpsAgentReportAckSchema, { description: "When to report next" })
	public report(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@Headers("authorization") authorization: string | undefined,
		@ZodBody(OpsAgentReportSchema) report: OpsAgentReport,
	): Promise<OpsAgentReportAck> {
		return this.commandBus.execute(new RecordAgentReportCommand(actor, bearerToken(authorization), report));
	}
}
