import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuditTrailDouble } from "../../../../../../test/support/audit-trail-double";
import { captureFastifyRequest } from "../../../../../../test/support/fastify-request";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { AuditContextMissingError, AuditLogWriteError } from "../../../../../platform/infrastructure/audit/audit-log.errors";
import { RequestContextService } from "../../../../../platform/infrastructure/context/request-context";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { AuditTrailSensitiveReadRecorder } from "../audit-trail-sensitive-read.recorder";

const SEED = { correlationId: "corr-view", ip: "203.0.113.1", userAgent: "vitest", edgeLocation: undefined };
/** What a GET answers with on success — the status the audited scope carries. */
const GET_SUCCESS_STATUS = 200;

describe("AuditTrailSensitiveReadRecorder", () => {
	const requestContext = new RequestContextService();
	const db = new PrismaService(createTestTypedConfig());
	let errorLog: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes the request's one audit row in the read's own transaction, with the summary as its response body", async () => {
		const { auditTrail, append, appendInTransaction } = createAuditTrailDouble(requestContext);
		const request = await captureFastifyRequest({ headers: {} });
		const recorder = new AuditTrailSensitiveReadRecorder(auditTrail, db);

		await requestContext.run(SEED, () =>
			auditTrail.runInScope({ request, successStatus: GET_SUCCESS_STATUS }, () => recorder.record({ auditLogView: { view: "list", returned: 3 } })),
		);

		expect(appendInTransaction).toHaveBeenCalledWith(
			db,
			expect.objectContaining({
				correlationId: "corr-view",
				outcome: "SUCCEEDED",
				responseStatus: GET_SUCCESS_STATUS,
				responseBody: { auditLogView: { view: "list", returned: 3 } },
			}),
		);
		expect(append).not.toHaveBeenCalled();
	});

	it("marks the request as audited, so the interceptor does not add the full response as a second row", async () => {
		const { auditTrail, append } = createAuditTrailDouble(requestContext);
		const request = await captureFastifyRequest({ headers: {} });
		const recorder = new AuditTrailSensitiveReadRecorder(auditTrail, db);

		await requestContext.run(SEED, async () => {
			await auditTrail.runInScope({ request, successStatus: GET_SUCCESS_STATUS }, () => recorder.record({ released: 1 }));
			await auditTrail.recordSuccess(request, GET_SUCCESS_STATUS, { items: [] });
		});

		expect(append).not.toHaveBeenCalled();
	});

	it("fails the read with AuditLogWriteError (500) and logs it when the row cannot be written", async () => {
		const { auditTrail, appendInTransaction } = createAuditTrailDouble(requestContext);
		appendInTransaction.mockRejectedValueOnce(new Error("db down"));
		const request = await captureFastifyRequest({ headers: {} });
		const recorder = new AuditTrailSensitiveReadRecorder(auditTrail, db);

		await expect(
			requestContext.run(SEED, () => auditTrail.runInScope({ request, successStatus: GET_SUCCESS_STATUS }, () => recorder.record({ released: 1 }))),
		).rejects.toBeInstanceOf(AuditLogWriteError);
		expect(errorLog).toHaveBeenCalledWith(expect.objectContaining({ event: "audit.write_failed", phase: "sensitive_read", error: "db down" }));
	});

	it("refuses outside an audited request instead of writing a row for nobody", async () => {
		const { auditTrail, appendInTransaction } = createAuditTrailDouble(requestContext);
		const recorder = new AuditTrailSensitiveReadRecorder(auditTrail, db);

		await expect(recorder.record({ released: 1 })).rejects.toBeInstanceOf(AuditContextMissingError);
		expect(appendInTransaction).not.toHaveBeenCalled();
	});
});
