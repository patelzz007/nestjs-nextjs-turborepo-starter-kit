import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/** A refund was asked of a payment that isn't paid. */
export class PaymentNotRefundableError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(status: string) {
		super("Only a paid payment can be refunded.", { status });
	}
}

/** A gateway answered in a way the adapter doesn't understand, or refused the request. */
export class PaymentProviderError extends DomainError {
	public readonly code: DomainErrorCode = "BAD_REQUEST";

	public constructor(provider: string, reason: string) {
		super(`The payment gateway (${provider}) refused the request.`, { provider, reason });
	}
}
