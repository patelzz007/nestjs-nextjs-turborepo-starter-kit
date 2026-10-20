import type { ErrorCode } from "./error-codes";

/** Primitive-only details so they serialise into the ADR 016 envelope safely. */
export type DomainErrorDetails = Record<string, string | number | boolean | null>;

export abstract class DomainError extends Error {
	public abstract readonly code: ErrorCode;

	protected constructor(
		message: string,
		public readonly details: DomainErrorDetails = {},
	) {
		super(message);
		this.name = new.target.name;
	}
}
