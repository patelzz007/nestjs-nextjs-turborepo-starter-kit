// ============================================
// flag-device-id.ts - this installed app's anonymous id for feature flags (ADR 087)
// ============================================
// A random UUID made the first time the app starts and kept in Secure Store, sent
// to the API as `X-Device-Id` so a flag decided per device gives this phone the
// same answer signed out and signed in. It identifies an installation, never a
// person. The API client reads it on every request (it is loaded while the app
// starts, after the client is built), so a request before then just carries none.

import { DEVICE_ID_HEADER, DeviceIdSchema } from "@workspace/shared";

import { readSecureValue, SECURE_STORE_ENTRIES, writeSecureValue } from "../../lib/secure-store";

/** The device id once loaded, read by the API client on each request. */
export class FlagDeviceId {
	private _value: string | null = null;

	/** The headers a request carries: the id, or none before it is loaded (or when it could not be). */
	public headers(): Readonly<Record<string, string>> {
		return this._value === null ? {} : { [DEVICE_ID_HEADER]: this._value };
	}

	public get current(): string | null {
		return this._value;
	}

	/** Takes the id read (or made) at start; anything that isn't a device id is ignored. */
	public use(id: string): void {
		const parsed = DeviceIdSchema.safeParse(id);
		if (parsed.success) {
			this._value = parsed.data;
		}
	}
}

/** What loading needs: Secure Store and a UUID maker (injected, so tests pass their own). */
export interface FlagDeviceIdStorage {
	readonly read: () => Promise<string | null>;
	readonly write: (id: string) => Promise<void>;
	readonly newId: () => string;
}

/** The stored id, or a new one saved for next time. Null when Secure Store can't be used: requests then carry none. */
export async function loadFlagDeviceId(storage: FlagDeviceIdStorage): Promise<string | null> {
	try {
		const stored = await storage.read();
		if (stored !== null) {
			return stored;
		}
		const fresh = storage.newId();
		await storage.write(fresh);
		return fresh;
	} catch {
		// The keychain can be locked or unavailable: flags then fall back to per-person answers (or their defaults).
		return null;
	}
}

/** Secure Store, as the device id is kept. */
export function secureStoreFlagDeviceIdStorage(newId: () => string): FlagDeviceIdStorage {
	return {
		read: (): Promise<string | null> => readSecureValue(SECURE_STORE_ENTRIES.flagDeviceId),
		write: (id: string): Promise<void> => writeSecureValue(SECURE_STORE_ENTRIES.flagDeviceId, id),
		newId,
	};
}
