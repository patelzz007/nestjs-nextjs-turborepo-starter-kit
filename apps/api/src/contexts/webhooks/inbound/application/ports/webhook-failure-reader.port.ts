import type { CaughtValue } from "@workspace/shared";

/** How a thrown error reads on the wire: the status the global exception filter answers it with, and one client-safe line. */
export interface WebhookFailure {
	readonly httpStatus: number;
	/** `CODE: message`, the message as the client sees it (a 5xx's generic one) — never a payload or a secret. */
	readonly summary: string;
}

/** Reads a thrown error the way the HTTP layer answers it, so the log records the status the provider really got. */
export interface WebhookFailureReaderPort {
	read(error: CaughtValue): WebhookFailure;
}
