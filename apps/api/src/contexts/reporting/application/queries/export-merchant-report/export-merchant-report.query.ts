import { Query } from "@nestjs/cqrs";
import type { MerchantAnalyticsExportQuery } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { ReportFile } from "../../ports/report-file.port";

export interface ExportMerchantReportInput {
	readonly tenantId: string;
	readonly query: MerchantAnalyticsExportQuery;
	readonly request: FastifyRequest;
}

/** The merchant dashboard's report file (`GET /tenants/:tenantSlug/analytics/export`); same authorization and store scope as the dashboard. `request` is the HTTP request the audit row describes. */
export class ExportMerchantReportQuery extends Query<ReportFile> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ExportMerchantReportInput,
	) {
		super();
	}
}
