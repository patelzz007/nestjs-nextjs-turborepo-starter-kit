import type { JsonValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

/**
 * Records a released analytics export as the request's audit row (a sensitive read: the summary of
 * what left the server replaces the response body). The HTTP request is the row's subject.
 * Throws when the row cannot be written, so nothing is released unaudited.
 */
export interface ReportExportAuditPort {
	recordExport(request: FastifyRequest, summary: JsonValue): Promise<void>;
}
