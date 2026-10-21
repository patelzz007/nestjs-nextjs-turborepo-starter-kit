import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";
/**
 * The account's token generation (`User.tokenVersion`). Every access token carries it; bumping it
 * invalidates every token issued before (password change or reset, 2FA enable or rotate, MFA
 * recovery, session revocation). It is also the compare-and-set token of credential writes (D35).
 */
export class TokenVersion {
	private constructor(public readonly value: number) {}

	public static of(value: number): TokenVersion {
		if (!Number.isInteger(value) || value < 0) {
			throw new CorruptAggregateStateError("token_version", null, "must be a non-negative integer");
		}
		return new TokenVersion(value);
	}

	/** The version every new token is issued with after a credential change. */
	public next(): TokenVersion {
		return new TokenVersion(this.value + 1);
	}

	public equals(other: TokenVersion): boolean {
		return this.value === other.value;
	}
}
