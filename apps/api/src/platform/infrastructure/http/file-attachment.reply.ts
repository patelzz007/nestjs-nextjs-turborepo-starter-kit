import type { Readable } from "node:stream";

import type { FastifyReply } from "fastify";

/** A file a route answers with directly (a report, an archive): its download name, media type and bytes. */
export interface FileAttachment {
	/** ASCII-safe (see `safeFileNameSegment` in @workspace/shared), so it fits the header's plain `filename` too. */
	readonly fileName: string;
	readonly contentType: string;
	readonly body: Readable;
}

/**
 * `attachment` with the (already ASCII-safe) name, plus the RFC 6266 / 5987
 * `filename*` form clients prefer.
 */
export function attachmentDisposition(fileName: string): string {
	return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Streams a file route's answer: its media type, `Content-Disposition:
 * attachment`, never cached (these files hold business data and are built
 * per request), never sniffed. The body is piped straight to the socket.
 */
export async function sendFileAttachment(reply: FastifyReply, file: FileAttachment): Promise<void> {
	await reply
		.header("Content-Type", file.contentType)
		.header("Content-Disposition", attachmentDisposition(file.fileName))
		.header("Cache-Control", "private, no-store, max-age=0")
		.header("Pragma", "no-cache")
		.header("X-Content-Type-Options", "nosniff")
		.send(file.body);
}
