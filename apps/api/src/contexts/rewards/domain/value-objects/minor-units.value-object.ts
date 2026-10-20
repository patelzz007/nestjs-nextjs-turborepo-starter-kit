import { MINOR_UNITS_PER_MAJOR } from "@workspace/shared";

import { InvalidMinorUnitsError } from "../errors/reward.errors";

/**
 * A non-negative money amount in integer minor units (sen). The single representation money
 * takes in the rewards domain; ringgit (possibly fractional) from the API is rounded to the sen.
 */
export class MinorUnits {
	private constructor(public readonly amount: number) {}

	public static of(amount: number): MinorUnits {
		if (!Number.isSafeInteger(amount) || amount < 0) {
			throw new InvalidMinorUnitsError();
		}
		return new MinorUnits(amount);
	}

	/** Ringgit → whole sen (half-up at the sen). */
	public static fromMajor(major: number): MinorUnits {
		return MinorUnits.of(Math.round(major * MINOR_UNITS_PER_MAJOR));
	}

	public toMajor(): number {
		return this.amount / MINOR_UNITS_PER_MAJOR;
	}

	public equals(other: MinorUnits): boolean {
		return this.amount === other.amount;
	}
}
