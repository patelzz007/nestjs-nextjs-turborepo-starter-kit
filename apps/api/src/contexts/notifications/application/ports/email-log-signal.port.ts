import type { EmailLogUpdatedEvent } from "@workspace/shared";
import type { Observable } from "rxjs";

/**
 * In-process "an email log row changed" signal (after commit) and the cold
 * stream the admin SSE route subscribes to. `null` frames are status flips
 * without an attempt payload (delivery webhooks).
 */
export interface EmailLogSignalPort {
	emitUpdated(event?: EmailLogUpdatedEvent): void;
	observeUpdates(): Observable<EmailLogUpdatedEvent | null>;
}
