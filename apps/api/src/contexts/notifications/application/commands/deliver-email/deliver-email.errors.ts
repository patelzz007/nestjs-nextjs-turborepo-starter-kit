/** The job names an email log row that does not exist: retrying cannot help. */
export class EmailLogMissingError extends Error {
	public constructor(emailLogId: string) {
		super(`Email log row ${emailLogId} does not exist`);
		this.name = "EmailLogMissingError";
	}
}

/** The attempt failed for good and the row is finalized `failed`: the caller must stop retrying. */
export class EmailDeliveryAbandonedError extends Error {
	public constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "EmailDeliveryAbandonedError";
	}
}

/** The attempt failed but another attempt may succeed (same idempotency key): the caller retries. */
export class EmailDeliveryRetryRequestedError extends Error {
	public constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "EmailDeliveryRetryRequestedError";
	}
}

/**
 * The provider ACCEPTED the email but recording that failed. A queued job
 * rethrows it (BullMQ retries; the provider idempotency key prevents a second
 * Resend send). The inline loop stops: the row stays `pending` and a delivery
 * webhook moves it forward later.
 */
export class EmailSentButNotRecordedError extends Error {
	public constructor(emailLogId: string, options?: ErrorOptions) {
		super(`Email ${emailLogId} was sent but its log row could not be finalized`, options);
		this.name = "EmailSentButNotRecordedError";
	}
}
