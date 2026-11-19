import * as crypto from "crypto";

import { DAY_MS } from "@workspace/shared";

import { SeededRandom } from "./prng";
import { DEFAULT_RANDOM_SEED } from "./seed-options";

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

/**
 * The stream every demo-data helper below draws from. Seeded (never
 * `Math.random()`), so the same `--seed` yields the same dataset; scenarios
 * call {@link useSeedRandom} with their `--seed` before seeding. Secrets
 * (tokens, keys) never come from here — they use `crypto`.
 */
let seedRandom: SeededRandom = SeededRandom.derive(DEFAULT_RANDOM_SEED, "demo-data");

/** Re-seeds the demo-data stream (call once per scenario run, before any helper). */
export function useSeedRandom(seed: number): void {
	seedRandom = SeededRandom.derive(seed, "demo-data");
}

export const rand = <T>(arr: readonly T[]): T => seedRandom.pick(arr);
export const randInt = (min: number, max: number): number => seedRandom.int(min, max);

/** A random, non-network/non-broadcast-looking IPv4 address for seeded sessions and logs. */
export const randomIpv4 = (): string => `${String(randInt(1, 254))}.${String(randInt(0, 255))}.${String(randInt(0, 255))}.${String(randInt(1, 254))}`;

// Epoch-millisecond helpers (DB stores BigInt epoch ms).
export const daysAgo = (n: number): number => Date.now() - n * DAY_MS;
export const daysFromNow = (n: number): number => Date.now() + n * DAY_MS;

/** Lowercase hex SHA-256 of raw bytes (file / message content hashes). */
export function sha256BytesHex(bytes: Uint8Array): string {
	return crypto.createHash("sha256").update(bytes).digest("hex");
}

/** Safely get an array element using modulo cycling. Assumes the array is non-empty. */
export const cycle = <T>(arr: T[], i: number): T => {
	const val = arr[i % arr.length];
	if (val === undefined) throw new Error("cycle: unexpected undefined");
	return val;
};
