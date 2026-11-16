import { Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiPath, DOCS_SYNC_REPORT_PATH, DocsSyncRunAckSchema, DocsSyncRunReportSchema, type DocsSyncRunAck, type DocsSyncRunReport } from "@workspace/shared";

import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { RecordDocsSyncRunCommand } from "../../application/commands/record-docs-sync-run/record-docs-sync-run.command";
import { DOCS_PUBLISHING_RECORD_OPERATION } from "../../application/ports/docs-publishing.ports";

const BEARER_PATTERN = /^Bearer (?<token>\S+)$/u;

function bearerToken(authorization: string | undefined): string | null {
	return BEARER_PATTERN.exec(authorization ?? "")?.groups?.token ?? null;
}

/** Where the docs sync reports (ADR 084). Not a session route: it presents `DOCS_SYNC_REPORT_TOKEN`, checked by the command. */
@ApiTags("Docs publishing")
@Controller(apiPath(DOCS_SYNC_REPORT_PATH))
export class DocsSyncReportController {
	public constructor(private readonly commandBus: CommandBus) {}

	@Public()
	@PublicOperation(DOCS_PUBLISHING_RECORD_OPERATION)
	@SkipMutationIntent()
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Post()
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "A docs sync's report (bearer: DOCS_SYNC_REPORT_TOKEN)" })
	@ZodResponse(DocsSyncRunAckSchema, { description: "The run was recorded" })
	public report(@Headers("authorization") authorization: string | undefined, @ZodBody(DocsSyncRunReportSchema) report: DocsSyncRunReport): Promise<DocsSyncRunAck> {
		return this.commandBus.execute(new RecordDocsSyncRunCommand(bearerToken(authorization), report));
	}
}
