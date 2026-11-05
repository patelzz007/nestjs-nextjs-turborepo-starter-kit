// ============================================
// privacy/presentation/http/personal-data.controller.ts — "Download my data" (ADR 077)
// ============================================
import { Controller, Get, Req, Res } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { apiContract, apiPath } from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodFileResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ExportPersonalDataQuery } from "../../application/queries/export-personal-data/export-personal-data.query";
import type { PersonalDataExport } from "../../application/queries/export-personal-data/export-personal-data.handler";

/** `attachment` with the (ASCII) name, plus the RFC 6266 / 5987 `filename*` form clients prefer. */
function attachmentDisposition(fileName: string): string {
	return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

@ApiTags("Privacy")
@Controller(apiPath("/me"))
export class PersonalDataController {
	public constructor(private readonly queryBus: QueryBus) {}

	@Get("data-export")
	@RateLimit(RATE_LIMIT_POLICY.personalDataExport)
	@ApiOperation({ summary: "Download everything the platform holds about you, as one ZIP (once a day; never while impersonating)" })
	@ZodFileResponse(apiContract.privacy.dataExport.response, { description: "The ZIP: manifest.json and one JSON file per section (Content-Disposition: attachment)" })
	public async dataExport(@CurrentActor() actor: ActorContext, @Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
		const download: PersonalDataExport = await this.queryBus.execute(new ExportPersonalDataQuery(actor, request));
		await reply
			.header("Content-Type", download.contentType)
			.header("Content-Disposition", attachmentDisposition(download.fileName))
			.header("Cache-Control", "private, no-store, max-age=0")
			.header("Pragma", "no-cache")
			.header("X-Content-Type-Options", "nosniff")
			.send(download.body);
	}
}
