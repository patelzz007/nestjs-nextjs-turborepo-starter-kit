// ============================================
// cached-bundle.ts - the last feature flag bundle, kept for a start without a connection (ADR 087)
// ============================================
// Each bundle the API sends is kept in Secure Store (the app keeps nothing
// elsewhere); a start without a connection shows what the API last said instead
// of every code default. A stored value that no longer matches the bundle's
// shape reads as none. A bundle too large for its entry simply isn't kept.

import { FeatureFlagBundleSchema, type FeatureFlagBundle } from "@workspace/shared";
import { z } from "zod";

import { FlagBundleValueSchema, readSecureValue, SECURE_STORE_ENTRIES, writeSecureValue } from "../../lib/secure-store";

/** Where a bundle is kept (injected, so tests pass their own). */
export interface BundleStorage {
	readonly read: () => Promise<string | null>;
	readonly write: (json: string) => Promise<void>;
}

/** The stored JSON as a bundle, or null when it isn't one. */
export function parseCachedBundle(json: string | null): FeatureFlagBundle | null {
	if (json === null) {
		return null;
	}
	try {
		const parsed = FeatureFlagBundleSchema.safeParse(z.json().parse(JSON.parse(json)));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/** The last bundle kept, or null (none yet, unreadable, or Secure Store unavailable). */
export async function readCachedBundle(storage: BundleStorage): Promise<FeatureFlagBundle | null> {
	try {
		return parseCachedBundle(await storage.read());
	} catch {
		return null;
	}
}

/** Keeps `bundle` for next time; one too large for its entry, or a store that can't be written, is skipped. */
export async function writeCachedBundle(storage: BundleStorage, bundle: FeatureFlagBundle): Promise<void> {
	const json = JSON.stringify(bundle);
	if (!FlagBundleValueSchema.safeParse(json).success) {
		return;
	}
	try {
		await storage.write(json);
	} catch {
		// A cache: the next start reads the API again.
	}
}

/** Secure Store, as the bundle is kept. */
export const SECURE_STORE_BUNDLE_STORAGE: BundleStorage = {
	read: (): Promise<string | null> => readSecureValue(SECURE_STORE_ENTRIES.flagBundle),
	write: (json: string): Promise<void> => writeSecureValue(SECURE_STORE_ENTRIES.flagBundle, json),
};
