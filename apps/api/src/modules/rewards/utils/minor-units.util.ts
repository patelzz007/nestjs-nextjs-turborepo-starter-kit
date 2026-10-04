/** A money amount read from a 64-bit column exceeds what JSON can carry exactly (Number.MAX_SAFE_INTEGER). */
export class MinorUnitsOverflowError extends Error {
	public constructor(value: bigint) {
		super(`Amount ${value.toString()} (minor units) exceeds the largest safe JSON integer`);
		this.name = "MinorUnitsOverflowError";
	}
}

/**
 * A `BIGINT` minor-unit amount (a bill, or a sum of bills) as a JSON-safe
 * number. Totals are stored 64-bit so sums never overflow the database; the
 * API carries them as plain integers (≤ 2^53 − 1 sen ≈ RM 90 trillion), and an
 * amount beyond that fails loudly instead of being silently rounded.
 */
export function minorUnitsToNumber(value: bigint | number): number {
	if (typeof value === "number") {
		return value;
	}
	if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
		throw new MinorUnitsOverflowError(value);
	}
	return Number(value);
}
