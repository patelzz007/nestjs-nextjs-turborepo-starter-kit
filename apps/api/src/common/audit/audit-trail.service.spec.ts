import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuditTrailDouble } from "../../../test/support/audit-trail-double";
import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { PrismaService } from "../../prisma/prisma.service";
import { captureFastifyRequest } from "../../../test/support/fastify-request";
import { RequestContextService } from "../context/request-context";
import { AuditContextMissingError, AuditLogWriteError } from "./audit-log.errors";

const SEED = { correlationId: "corr-trail", ip: "203.0.113.1", userAgent: "vitest", edgeLocation: undefined };

describe("AuditTrailService", () => {
	const requestContext = new RequestContextService();
	let errorLog: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		errorLog = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("appends one SUCCEEDED row for a state-changing request", async () => {
		const { auditTrail, append } = createAuditTrailDouble(requestContext);
		const request = await captureFastifyRequest({ headers: {} });

		await requestContext.run(SEED, () => auditTrail.recordSuccess(request, 201, { id: "x" }));

		expect(append).toHaveBeenCalledWith(expect.objectContaining({ correlationId: "corr-trail", outcome: "SUCCEEDED", responseStatus: 201, responseBody: { id: "x" } }));
	});

	it("fails the request (500 AuditLogWriteError) when the success row cannot be written, and logs the full entry", async () => {
		const { auditTrail, append } = createAuditTrailDouble(requestContext);
		append.mockRejectedValueOnce(new Error("db down"));
		const request = await captureFastifyRequest({ headers: {} });

		await expect(requestContext.run(SEED, () => auditTrail.recordSuccess(request, 201, { id: "x" }))).rejects.toBeInstanceOf(AuditLogWriteError);
		expect(errorLog).toHaveBeenCalledWith(expect.objectContaining({ event: "audit.write_failed", phase: "success" }));
	});

	it("audits a sensitive GET (an export) with the summary as its response body", async () => {
		const { auditTrail, append } = createAuditTrailDouble(requestContext);
		const request = await captureFastifyRequest({ headers: {} });

		await requestContext.run(SEED, () => auditTrail.recordSensitiveRead(request, 200, { report: "merchant", format: "csv", rowCounts: { series: 3 } }));

		expect(append).toHaveBeenCalledWith(
			expect.objectContaining({
				correlationId: "corr-trail",
				outcome: "SUCCEEDED",
				responseStatus: 200,
				responseBody: { report: "merchant", format: "csv", rowCounts: { series: 3 } },
			}),
		);
	});

	it("refuses to release a sensitive read whose audit row cannot be written (AuditLogWriteError)", async () => {
		const { auditTrail, append } = createAuditTrailDouble(requestContext);
		append.mockRejectedValueOnce(new Error("db down"));
		const request = await captureFastifyRequest({ headers: {} });

		await expect(requestContext.run(SEED, () => auditTrail.recordSensitiveRead(request, 200, { report: "merchant" }))).rejects.toBeInstanceOf(AuditLogWriteError);
		expect(errorLog).toHaveBeenCalledWith(expect.objectContaining({ event: "audit.write_failed", phase: "sensitive_read" }));
	});

	it("never throws on the failure path: the original error must reach the client, the lost entry is logged", async () => {
		const { auditTrail, append } = createAuditTrailDouble(requestContext);
		append.mockRejectedValueOnce(new Error("db down"));
		const request = await captureFastifyRequest({ headers: {} });

		await expect(
			requestContext.run(SEED, () => auditTrail.recordFailure(request, { status: 403, errorCode: "FORBIDDEN", responseBody: { success: false } })),
		).resolves.toBeUndefined();
		expect(errorLog).toHaveBeenCalledWith(expect.objectContaining({ event: "audit.write_failed", phase: "failure" }));
	});

	it("does not write a second success row when the handler already recorded it in its own transaction", async () => {
		const { auditTrail, append, appendInTransaction } = createAuditTrailDouble(requestContext);
		const request = await captureFastifyRequest({ headers: {} });

		await requestContext.run(SEED, async () => {
			await auditTrail.runInScope({ request, successStatus: 201 }, () => auditTrail.recordInTransaction(new PrismaService(createTestTypedConfig()), { id: "x" }));
			await auditTrail.recordSuccess(request, 201, { id: "x" });
		});

		expect(appendInTransaction).toHaveBeenCalledTimes(1);
		expect(append).not.toHaveBeenCalled();
	});

	it("refuses recordInTransaction outside an audited request", async () => {
		const { auditTrail } = createAuditTrailDouble(requestContext);

		await expect(auditTrail.recordInTransaction(new PrismaService(createTestTypedConfig()), {})).rejects.toBeInstanceOf(AuditContextMissingError);
	});
});
