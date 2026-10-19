import { Query } from "@nestjs/cqrs";
import type { AdminAnalyticsExportQuery } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ReportFile } from "../../ports/report-file.port";

export interface ExportPlatformReportInput {
	readonly query: AdminAnalyticsExportQuery;
	readonly request: FastifyRequest;
}

/** The platform report file (`GET /admin/analytics/export`); the route enforces `READ ANALYTICS`. `request` is the HTTP request the audit row describes. */
export class ExportPlatformReportQuery extends Query<ReportFile> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ExportPlatformReportInput,
	) {
		super();
	}
}
