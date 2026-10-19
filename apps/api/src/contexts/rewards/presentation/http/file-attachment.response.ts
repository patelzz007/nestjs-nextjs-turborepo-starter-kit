import type { FastifyReply } from "fastify";

import type { RewardImagesArchive } from "../../application/ports/reward-read.port";

/** `attachment` with the (already ASCII-safe) name, plus the RFC 6266 / 5987 `filename*` form clients prefer. */
function attachmentDisposition(fileName: string): string {
	return `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Streams a file answer: its media type, `Content-Disposition: attachment`, never cached (built
 * per request from business data), never sniffed. Same headers as the platform file reply,
 * which presentation may not import from infrastructure.
 */
export async function sendRewardFileAttachment(reply: FastifyReply, file: RewardImagesArchive): Promise<void> {
	await reply
		.header("Content-Type", file.contentType)
		.header("Content-Disposition", attachmentDisposition(file.fileName))
		.header("Cache-Control", "private, no-store, max-age=0")
		.header("Pragma", "no-cache")
		.header("X-Content-Type-Options", "nosniff")
		.send(file.body);
}
