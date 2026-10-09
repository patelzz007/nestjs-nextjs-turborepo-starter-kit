// ============================================
// secure-store.ts - the one typed door to expo-secure-store
// ============================================
// Everything the app keeps on the device lives in the OS secret store
// (Keychain / Keystore) — tokens AND preferences; AsyncStorage is banned
// (docs/technical/mobile/mobile-app.md §9.7, rules/04). Nothing is stored under
// an ad-hoc key: every entry is declared once in SECURE_STORE_ENTRIES with the
// zod schema its value must match. Values are stored as JSON. Every read goes
// through the schema; a corrupt or unexpected value is treated as absent and
// removed (or overwritten with the default), never cast.

import { AccessTokenValueSchema, RefreshTokenValueSchema } from "@workspace/shared";
import * as SecureStore from "expo-secure-store";
import { z } from "zod";

/** The appearance the user chose: follow the OS, or force one theme. */
export const ThemePreferenceSchema = z.enum(["system", "light", "dark"]);

export type ThemePreference = z.output<typeof ThemePreferenceSchema>;

/** The app lock's timeouts (§11.2): Immediately, 1 minute, 5 minutes. */
export const APP_LOCK_TIMEOUT_IMMEDIATELY_MS = 0;
export const APP_LOCK_TIMEOUT_ONE_MINUTE_MS = 60_000;
export const APP_LOCK_TIMEOUT_FIVE_MINUTES_MS = 300_000;

export const AppLockTimeoutMsSchema = z.union([
	z.literal(APP_LOCK_TIMEOUT_IMMEDIATELY_MS),
	z.literal(APP_LOCK_TIMEOUT_ONE_MINUTE_MS),
	z.literal(APP_LOCK_TIMEOUT_FIVE_MINUTES_MS),
]);

export type AppLockTimeoutMs = z.output<typeof AppLockTimeoutMsSchema>;

/** Upper bound of the stored biometric fingerprint (`<level>:<types>` stays far below it). */
const BIOMETRIC_FINGERPRINT_MAX_LENGTH = 64;

/** Fingerprint of the device's enrolled authentication when the app lock was turned on (see features/app-lock). */
export const BiometricFingerprintSchema = z.string().min(1).max(BIOMETRIC_FINGERPRINT_MAX_LENGTH);

/** One declared Secure Store entry: its key and the schema its value must match. */
export interface SecureStoreEntry<TValue> {
	readonly key: string;
	readonly schema: z.ZodType<TValue>;
}

/** The registry (§9.7). Keys use only the characters Secure Store accepts (letters, digits, `.`, `-`, `_`). */
export const SECURE_STORE_ENTRIES = {
	accessToken: { key: "auth.accessToken", schema: AccessTokenValueSchema },
	refreshToken: { key: "auth.refreshToken", schema: RefreshTokenValueSchema },
	theme: { key: "prefs.theme", schema: ThemePreferenceSchema },
	appLockEnabled: { key: "prefs.appLock.enabled", schema: z.boolean() },
	appLockTimeoutMs: { key: "prefs.appLock.timeoutMs", schema: AppLockTimeoutMsSchema },
	appLockBiometricFingerprint: { key: "prefs.appLock.enrolledBiometrics", schema: BiometricFingerprintSchema },
} satisfies Record<string, SecureStoreEntry<string | number | boolean>>;

/** JSON as stored: any value a registry schema can describe. */
const StoredJsonSchema = z.union([z.string(), z.number(), z.boolean()]);

/** Secure Store could not be read or written (keychain unavailable, device locked during a background read, …). */
export class SecureStoreUnavailableError extends Error {
	public constructor(key: string, options: { readonly cause: Error | string }) {
		super(`Secure Store is unavailable for "${key}"`, options);
		this.name = "SecureStoreUnavailableError";
	}
}

/** What a failed native call can reject with. */
const ThrownValueSchema = z.union([z.instanceof(Error), z.string()]);

function unavailable(key: string, cause: Error | string | undefined): SecureStoreUnavailableError {
	return new SecureStoreUnavailableError(key, { cause: cause ?? "unknown error" });
}

function decode<TValue>(entry: SecureStoreEntry<TValue>, raw: string): TValue | null {
	try {
		const json = StoredJsonSchema.safeParse(JSON.parse(raw));
		if (!json.success) {
			return null;
		}
		const value = entry.schema.safeParse(json.data);
		return value.success ? value.data : null;
	} catch {
		return null;
	}
}

async function readRaw(key: string): Promise<string | null> {
	try {
		return await SecureStore.getItemAsync(key);
	} catch (error: unknown) {
		throw unavailable(key, ThrownValueSchema.safeParse(error).data);
	}
}

/**
 * The entry's value, or `null` when it is absent. A corrupt value is removed and
 * reads as absent.
 *
 * @throws {SecureStoreUnavailableError} when the store itself cannot be read.
 */
export async function readSecureValue<TValue>(entry: SecureStoreEntry<TValue>): Promise<TValue | null> {
	const raw = await readRaw(entry.key);
	if (raw === null) {
		return null;
	}
	const value = decode(entry, raw);
	if (value === null) {
		await deleteSecureValue(entry);
	}
	return value;
}

/**
 * The entry's value, or `fallback` when it is absent, corrupt (then overwritten
 * with `fallback`) or the store cannot be read (left untouched).
 */
export async function readSecureValueOrDefault<TValue>(entry: SecureStoreEntry<TValue>, fallback: TValue): Promise<TValue> {
	let raw: string | null;
	try {
		raw = await readRaw(entry.key);
	} catch {
		return fallback;
	}
	if (raw === null) {
		return fallback;
	}
	const value = decode(entry, raw);
	if (value === null) {
		await writeSecureValue(entry, fallback);
		return fallback;
	}
	return value;
}

/** Stores `value` after checking it against the entry's schema (a wrong value is a bug, never stored). */
export async function writeSecureValue<TValue>(entry: SecureStoreEntry<TValue>, value: TValue): Promise<void> {
	const checked = StoredJsonSchema.parse(entry.schema.parse(value));
	try {
		await SecureStore.setItemAsync(entry.key, JSON.stringify(checked));
	} catch (error: unknown) {
		throw unavailable(entry.key, ThrownValueSchema.safeParse(error).data);
	}
}

/** Removes the entry (absent already is fine). */
export async function deleteSecureValue<TValue>(entry: SecureStoreEntry<TValue>): Promise<void> {
	try {
		await SecureStore.deleteItemAsync(entry.key);
	} catch (error: unknown) {
		throw unavailable(entry.key, ThrownValueSchema.safeParse(error).data);
	}
}
