import type { FastifyReply } from "fastify";

import type { AnalyticsExportFile } from "./analytics-export.service";

/**
 * `attachment` with the (already ASCII-safe, see `analyticsExportFileName`)
 * name, plus the RFC 6266 / 5987 `filename*` form clients prefer.
 */
export function attachmentDisposition(fileName: string): string {
	return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Streams an export: its media type, `Content-Disposition: attachment`, never
 * cached (a report holds business data and changes as bills arrive), never
 * sniffed. The body is piped straight to the socket.
 */
export async function sendAnalyticsExport(reply: FastifyReply, file: AnalyticsExportFile): Promise<void> {
	await reply
		.header("Content-Type", file.contentType)
		.header("Content-Disposition", attachmentDisposition(file.fileName))
		.header("Cache-Control", "private, no-store, max-age=0")
		.header("Pragma", "no-cache")
		.header("X-Content-Type-Options", "nosniff")
		.send(file.body);
}
