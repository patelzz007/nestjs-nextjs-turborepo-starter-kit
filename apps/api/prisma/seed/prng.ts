// ---------------------------------------------------------------------------
// Deterministic pseudo-random numbers for seed scenarios.
//
// `Math.random()` makes a seed produce a different dataset on every run, which
// breaks "same input → same database" (rules/08-database-prisma.md). This is a
// tiny native PRNG (mulberry32) so `pnpm db:seed -- --seed 123` always yields
// byte-identical data. It is NOT cryptographically secure — never use it for
// tokens, passwords, or API keys.
// ---------------------------------------------------------------------------

/** Largest accepted seed: seeds are unsigned 32-bit integers. */
export const MAX_RANDOM_SEED = 0xffff_ffff;

/** 2^32 — divides a uint32 into the [0, 1) float range. */
const UINT32_RANGE = 0x1_0000_0000;

/** mulberry32 state increment (Weyl sequence constant from the reference implementation). */
const MULBERRY32_INCREMENT = 0x6d2b_79f5;

/** mulberry32 output-mixing constants (reference implementation). */
const MULBERRY32_SHIFT_A = 15;
const MULBERRY32_SHIFT_B = 7;
const MULBERRY32_SHIFT_C = 14;
const MULBERRY32_MIX_OR = 61;

/** FNV-1a 32-bit parameters — used to derive independent sub-streams from a label. */
const FNV1A_OFFSET_BASIS = 0x811c_9dc5;
const FNV1A_PRIME = 0x0100_0193;

export class InvalidRandomSeedError extends Error {
	public constructor(public readonly seed: number) {
		super(`Random seed must be an integer between 0 and ${String(MAX_RANDOM_SEED)} (received ${String(seed)})`);
		this.name = "InvalidRandomSeedError";
	}
}

export class InvalidRandomRangeError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "InvalidRandomRangeError";
	}
}

function isValidSeed(seed: number): boolean {
	return Number.isInteger(seed) && seed >= 0 && seed <= MAX_RANDOM_SEED;
}

/** FNV-1a (32-bit) hash of a string — stable, dependency-free label → uint32. */
export function hashLabelToSeed(label: string): number {
	let hash = FNV1A_OFFSET_BASIS;
	for (const character of label) {
		const codePoint = character.codePointAt(0) ?? 0;
		hash ^= codePoint;
		hash = Math.imul(hash, FNV1A_PRIME) >>> 0;
	}
	return hash >>> 0;
}

/**
 * Seeded PRNG (mulberry32). Same seed → same sequence, on every machine.
 *
 * Use {@link SeededRandom.derive} to give each dataset section (locations,
 * members, products…) its own stream, so adding a draw in one section never
 * shifts the values generated for another.
 */
export class SeededRandom {
	private state: number;

	public constructor(seed: number) {
		if (!isValidSeed(seed)) {
			throw new InvalidRandomSeedError(seed);
		}
		this.state = seed;
	}

	/** Independent stream for `label`, fully determined by `(seed, label)`. */
	public static derive(seed: number, label: string): SeededRandom {
		if (!isValidSeed(seed)) {
			throw new InvalidRandomSeedError(seed);
		}
		return new SeededRandom(hashLabelToSeed(`${String(seed)}:${label}`));
	}

	/** Next float in `[0, 1)`. */
	public next(): number {
		this.state = (this.state + MULBERRY32_INCREMENT) >>> 0;
		let mixed = this.state;
		mixed = Math.imul(mixed ^ (mixed >>> MULBERRY32_SHIFT_A), mixed | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> MULBERRY32_SHIFT_B), mixed | MULBERRY32_MIX_OR);
		return ((mixed ^ (mixed >>> MULBERRY32_SHIFT_C)) >>> 0) / UINT32_RANGE;
	}

	/** Integer in `[minInclusive, maxInclusive]`. */
	public int(minInclusive: number, maxInclusive: number): number {
		if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxInclusive)) {
			throw new InvalidRandomRangeError(`int() bounds must be safe integers (received ${String(minInclusive)}..${String(maxInclusive)})`);
		}
		if (minInclusive > maxInclusive) {
			throw new InvalidRandomRangeError(`int() lower bound ${String(minInclusive)} exceeds upper bound ${String(maxInclusive)}`);
		}
		return minInclusive + Math.floor(this.next() * (maxInclusive - minInclusive + 1));
	}

	/** One element of a non-empty list. */
	public pick<TItem>(items: readonly TItem[]): TItem {
		if (items.length === 0) {
			throw new InvalidRandomRangeError("pick() requires a non-empty list");
		}
		const item = items.at(this.int(0, items.length - 1));
		if (item === undefined) {
			throw new InvalidRandomRangeError("pick() selected an index outside the list");
		}
		return item;
	}

	/** `true` with the given probability (`0` = never, `1` = always). */
	public chance(probability: number): boolean {
		if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
			throw new InvalidRandomRangeError(`chance() probability must be within [0, 1] (received ${String(probability)})`);
		}
		return this.next() < probability;
	}
}
