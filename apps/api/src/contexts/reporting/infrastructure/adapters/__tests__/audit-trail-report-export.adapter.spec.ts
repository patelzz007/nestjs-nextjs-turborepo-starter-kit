import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuditTrailDouble } from "../../../../../../test/support/audit-trail-double";
import { captureFastifyRequest } from "../../../../../../test/support/fastify-request";
import { AuditLogWriteError } from "../../../../../platform/infrastructure/audit/audit-log.errors";
import { RequestContextService } from "../../../../../platform/infrastructure/context/request-context";
import { AuditTrailReportExportAdapter } from "../audit-trail-report-export.adapter";

const SEED = { correlationId: "corr-export", ip: "203.0.113.9", userAgent: "vitest", edgeLocation: undefined };
const SUMMARY = { export: { report: "merchant", subject: "brew-and-bean", format: "csv" } };

describe("AuditTrailReportExportAdapter", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes the export summary as the request's 200 sensitive-read audit row", async () => {
		const requestContext = new RequestContextService();
		const { auditTrail, append } = createAuditTrailDouble(requestContext);
		const request = await captureFastifyRequest({ headers: {} });

		await requestContext.run(SEED, () => new AuditTrailReportExportAdapter(auditTrail).recordExport(request, SUMMARY));

		expect(append).toHaveBeenCalledTimes(1);
		expect(append).toHaveBeenCalledWith(expect.objectContaining({ outcome: "SUCCEEDED", responseStatus: 200, responseBody: SUMMARY }));
	});

	it("fails when the audit row cannot be written", async () => {
		const requestContext = new RequestContextService();
		const { auditTrail, append } = createAuditTrailDouble(requestContext);
		append.mockRejectedValueOnce(new Error("db down"));
		vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
		const request = await captureFastifyRequest({ headers: {} });

		await expect(requestContext.run(SEED, () => new AuditTrailReportExportAdapter(auditTrail).recordExport(request, SUMMARY))).rejects.toBeInstanceOf(AuditLogWriteError);
	});
});
