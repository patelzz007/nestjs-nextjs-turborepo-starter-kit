import type { DeviceType } from "@prisma/client";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

export const rand = <T>(arr: T[]): T => {
	const index = Math.floor(Math.random() * arr.length);
	const value = arr[index];
	if (value === undefined) throw new Error("rand: unexpected undefined");
	return value;
};
export const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Epoch-millisecond helpers (DB stores BigInt epoch ms).
export const daysAgo = (n: number) => Date.now() - n * 86_400_000;
export const daysFromNow = (n: number) => Date.now() + n * 86_400_000;

/** Safely get an array element using modulo cycling. Assumes the array is non-empty. */
export const cycle = <T>(arr: T[], i: number): T => {
	const val = arr[i % arr.length];
	if (val === undefined) throw new Error("cycle: unexpected undefined");
	return val;
};

// ---------------------------------------------------------------------------
// Seed data constants
// ---------------------------------------------------------------------------

export const COUNTRIES = ["MY", "US", "GB", "SG", "AU", "IN", "DE", "JP", "CA", "FR", "BR", "KR"];
export const CITIES = ["Kuala Lumpur", "New York", "London", "Singapore", "Sydney", "Mumbai", "Berlin", "Tokyo", "Toronto", "Paris", "São Paulo", "Seoul"];
export const DEVICES: DeviceType[] = ["DESKTOP", "DESKTOP", "MOBILE", "MOBILE", "MOBILE", "TABLET", "BOT"];
export const OSS = ["Windows", "macOS", "Android", "iOS", "Linux", "Ubuntu", "ChromeOS"];
export const BROWSERS = ["Chrome", "Safari", "Firefox", "Edge", "Samsung Internet", "Opera", "Brave"];
export const REFERRERS = [
	"https://google.com",
	"https://twitter.com",
	"https://facebook.com",
	"https://linkedin.com",
	"https://reddit.com",
	"https://instagram.com",
	null,
	null,
	null, // nulls = direct traffic (weighted higher)
];
export const UTM_SOURCES = ["google", "facebook", "twitter", "linkedin", "email", "newsletter"];
export const UTM_MEDIUMS = ["cpc", "social", "email", "organic", "referral", "display"];

// ---------------------------------------------------------------------------
// API key generation
// ---------------------------------------------------------------------------

/**
 * Charset for generating random API key segments (no ambiguous chars: 0/O, 1/l/I).
 * Matches the charset used in api-keys.service.ts for consistent key format.
 */
export const API_KEY_CHARSET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const API_KEY_RANDOM_LENGTH = 25;
export const KEY_PREFIX_LENGTH = 14;

/**
 * Generate a cryptographically random API key matching the service's format.
 * Returns { rawKey, keyPrefix }.
 * Format: sk_live_ + 25 random alphanumeric chars = 33 chars total.
 */
export function generateSeedApiKey(): { rawKey: string; keyPrefix: string } {
	const bytes = crypto.randomBytes(API_KEY_RANDOM_LENGTH);
	let randomPart = "";
	for (let i = 0; i < API_KEY_RANDOM_LENGTH; i++) {
		const byteValue = bytes[i];
		if (byteValue !== undefined) {
			randomPart += API_KEY_CHARSET.charAt(byteValue % API_KEY_CHARSET.length);
		}
	}
	const rawKey = `sk_live_${randomPart}`;
	const keyPrefix = rawKey.slice(0, KEY_PREFIX_LENGTH);
	return { rawKey, keyPrefix };
}
