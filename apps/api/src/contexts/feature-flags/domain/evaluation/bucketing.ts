// ── Stable buckets (GLOSSARY: rollout unit) ──────────────────────────────────────────────────────
// A subject's bucket is a stable FNV-1a hash of a seed and its id, so the same subject always lands in the
// same place: raising a percentage only ever adds subjects, and an experiment keeps each subject's variant.

/** Buckets a percentage is cut into: one per percent. */
export const BUCKETS = 100;

const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;
const NO_CODE_POINT = 0;

/** The bucket (0–99) of `id` under `seed`. */
export function bucketOf(seed: string, id: string): number {
	let hash = FNV_OFFSET_BASIS;
	for (const character of `${seed}:${id}`) {
		hash = Math.imul(hash ^ (character.codePointAt(0) ?? NO_CODE_POINT), FNV_PRIME) >>> 0;
	}
	return hash % BUCKETS;
}

/** Whether `id` falls inside `percentage` under `seed`. */
export function isWithinPercentage(seed: string, id: string, percentage: number): boolean {
	return bucketOf(seed, id) < percentage;
}

/** The seed a feature flag's (or config's) percentages share, so a ramp only ever adds subjects. */
export function rolloutSeed(key: string): string {
	return key;
}

/** The seed deciding whether a subject takes part in an experiment. */
export function experimentTrafficSeed(salt: string): string {
	return `experiment:${salt}:traffic`;
}

/** The seed deciding which variant a taking-part subject gets. */
export function experimentVariantSeed(salt: string): string {
	return `experiment:${salt}:variant`;
}

/**
 * The variant a bucket falls in: variants take consecutive slices of the 100 buckets in order, each as wide as
 * its allocation. Null when the allocations don't reach the bucket (they always share 100% once validated).
 */
export function variantAt<TVariant extends { readonly allocation: number }>(variants: readonly TVariant[], bucket: number): TVariant | null {
	let upper = 0;
	for (const variant of variants) {
		upper += variant.allocation;
		if (bucket < upper) {
			return variant;
		}
	}
	return null;
}
