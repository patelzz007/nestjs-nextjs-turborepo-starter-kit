import type { InAppNotificationSignal, NotificationSurface } from "@workspace/shared";

/** Tells every API instance that a person's inbox changed (Redis pub/sub), for the live stream. */
export interface InAppSignalPort {
	publish(userId: string, signal: InAppNotificationSignal): Promise<void>;
	/** Listens for one person's signals on one surface; returns the unsubscribe function. */
	subscribe(userId: string, surface: NotificationSurface, listener: (signal: InAppNotificationSignal) => void): () => void;
}

export const IN_APP_SIGNAL = Symbol("IN_APP_SIGNAL");
