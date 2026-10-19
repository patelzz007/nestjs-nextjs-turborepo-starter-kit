import { CanonicalEmailSchema } from "@workspace/shared";

import { InvalidEmailAddressError } from "../errors/identity.errors";

/**
 * An account email in its canonical form (the shared {@link CanonicalEmailSchema}: a valid,
 * bounded address, lower-cased). Two addresses that differ only in case are the same account.
 */
export class EmailAddress {
	private constructor(public readonly value: string) {}

	/** Validates and canonicalises `raw`. Throws {@link InvalidEmailAddressError} for anything the shared contract rejects. */
	public static of(raw: string): EmailAddress {
		const parsed = CanonicalEmailSchema.safeParse(raw);
		if (!parsed.success) {
			throw new InvalidEmailAddressError();
		}
		return new EmailAddress(parsed.data);
	}

	public equals(other: EmailAddress): boolean {
		return this.value === other.value;
	}

	public toString(): string {
		return this.value;
	}
}
