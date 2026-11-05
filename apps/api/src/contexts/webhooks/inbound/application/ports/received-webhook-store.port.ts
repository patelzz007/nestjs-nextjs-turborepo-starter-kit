import type { ReceivedWebhookHeaders, ReceivedWebhookOutcome, ReceivedWebhookProvider } from "@workspace/shared";

/** What every row records about the request itself. */
export interface ReceivedWebhookFacts {
	readonly provider: ReceivedWebhookProvider;
	/** Hex SHA-256 of the raw body. */
	readonly payloadSha256: string;
	readonly payloadBytes: number;
	readonly headers: ReceivedWebhookHeaders;
	readonly correlationId: string | null;
	readonly receivedAt: number;
}

/** A request refused before its delivery could be claimed: no key, or a missing or bad signature. It claims no delivery id. */
export interface RefusedWebhookRecord extends ReceivedWebhookFacts {
	readonly verification: "INVALID" | "MISSING" | "NOT_CONFIGURED";
	readonly httpStatus: number;
	readonly errorSummary: string;
}

/** A verified delivery to claim before it is handed to its owning context. */
export interface DeliveryClaimRequest extends ReceivedWebhookFacts {
	/** Null when the provider's request carries no id: then nothing can be deduplicated, and a row is simply added. */
	readonly providerDeliveryId: string | null;
	readonly eventType: string | null;
	/** A PROCESSING claim made before this (epoch ms) is taken over: its holder is presumed gone. */
	readonly staleClaimBefore: number;
}

/**
 * What a claim came to: this request holds the delivery (a first delivery, or the retry of one that
 * FAILED / was REJECTED / whose claim went stale); the delivery was already answered (a redelivery); or
 * another request is processing it right now (within the lease).
 */
export type DeliveryClaim =
	| { readonly kind: "claimed"; readonly id: string }
	| { readonly kind: "duplicate"; readonly id: string }
	| { readonly kind: "in_flight"; readonly id: string };

/** The outcomes an owning context's answer can record (PROCESSING is only ever the claim's). */
export type CompletedWebhookOutcome = Exclude<ReceivedWebhookOutcome, "PROCESSING">;

/** How a claimed delivery ended. */
export interface DeliveryCompletion {
	readonly id: string;
	readonly outcome: CompletedWebhookOutcome;
	readonly httpStatus: number;
	/** The owner's name for the event, when only the owner could read it; null keeps the claim's. */
	readonly eventType: string | null;
	readonly errorSummary: string | null;
	readonly completedAt: number;
}

/**
 * The received-webhook log (bypass-only, operation `webhooks.inbound.record`). Every statement is
 * atomic on its own: a claim is one INSERT … ON CONFLICT, so two instances receiving the same
 * delivery at once never both process it.
 */
export interface ReceivedWebhookStorePort {
	recordRefused(record: RefusedWebhookRecord): Promise<void>;
	claim(request: DeliveryClaimRequest): Promise<DeliveryClaim>;
	complete(completion: DeliveryCompletion): Promise<void>;
	/** Deletes rows last received before `beforeMs`; answers how many. */
	prune(beforeMs: number): Promise<number>;
}
