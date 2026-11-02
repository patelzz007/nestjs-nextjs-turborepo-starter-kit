import type { NotificationSurface } from "@workspace/shared";

/** One row of the earlier reward inbox (`RewardNotification`), as its owner (claims) hands it over (ADR 070). */
export interface LegacyInboxNotice {
	/** The legacy row's id: importing the same row twice writes nothing the second time. */
	readonly legacyId: string;
	readonly userId: string;
	/** Which app's inbox it belongs in: reward-review notices went to merchants, the rest to customers. */
	readonly surface: NotificationSurface;
	readonly title: string;
	readonly body: string;
	readonly link: string | null;
	readonly readAt: number | null;
	readonly createdAt: number;
}

/**
 * The one-time move of the earlier reward inbox into the unified inbox (ADR 070), bound to the CALLER'S
 * transaction so the copy and the legacy row's soft delete commit together. Copied rows keep their words,
 * read state and time; nothing is delivered again.
 */
export interface LegacyInboxImportPort {
	/** Returns how many notices were new (a repeat of an imported row is skipped). */
	import(notices: readonly LegacyInboxNotice[], now: number): Promise<number>;
}
