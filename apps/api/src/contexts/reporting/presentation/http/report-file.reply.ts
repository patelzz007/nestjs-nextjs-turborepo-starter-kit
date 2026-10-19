import type { FastifyReply } from "fastify";

import type { ReportFile } from "../../application/ports/report-file.port";

/** `attachment` with the (already ASCII-safe) name, plus the RFC 6266 / 5987 `filename*` form clients prefer. */
export function reportAttachmentDisposition(fileName: string): string {
	return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Streams a report download: its media type, `Content-Disposition: attachment`, never cached (a
 * report holds business data and is built per request), never sniffed. The same headers as the
 * platform's file-attachment reply, which presentation may not import (it lives in infrastructure).
 */
export async function sendReportFile(reply: FastifyReply, file: ReportFile): Promise<void> {
	await reply
		.header("Content-Type", file.contentType)
		.header("Content-Disposition", reportAttachmentDisposition(file.fileName))
		.header("Cache-Control", "private, no-store, max-age=0")
		.header("Pragma", "no-cache")
		.header("X-Content-Type-Options", "nosniff")
		.send(file.body);
}
