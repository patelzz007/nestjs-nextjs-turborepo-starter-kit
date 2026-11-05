// ============================================
// inbound-webhook-receiver.ts - verify → claim → hand over → record (ADR 081)
// ============================================
// The single application path of every inbound webhook. The order is the security argument:
//
// 1. No key configured → logged NOT_CONFIGURED, the route's 503 thrown (the provider retries later).
// 2. The signature is checked before anything in the body is read. Missing / invalid → logged with NO
//    delivery id (an unsigned request can never claim, and so never block, a real delivery), the route's
//    own 401/403 thrown.
// 3. The verified delivery is claimed by (provider, delivery id) in one INSERT … ON CONFLICT: a delivery
//    already answered is a redelivery (the route answers its usual 2xx, nothing is processed); one being
//    processed by another request right now answers 409 so the provider retries (a 2xx could lose it if
//    that other attempt then fails); one that FAILED or was REJECTED, or whose claim went stale, is
//    processed again.
// 4. The owning context's handler runs in its own system operation and transaction; its answer (or the
//    status its error is answered with) is recorded on the row.
//
// The hand-over is at-least-once: a process that dies between the owner's commit and step 4 leaves a
// PROCESSING claim that a redelivery takes over after the lease, so every owner's handler is idempotent
// on its own effect (GitHub's ON CONFLICT, Resend's webhook id, a payment status that does not change,
// Twilio's status update and suppression).

import { createHash } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";
import { ConflictError } from "../../../../../platform/application/errors/app-error";
import { HTTP_SERVER_ERROR_MIN_STATUS } from "../../../../../platform/application/errors/http-status";
import { keptHeaders } from "../../domain/kept-headers";
import type { CompletedWebhookOutcome, DeliveryCompletion, ReceivedWebhookFacts, ReceivedWebhookStorePort, RefusedWebhookRecord } from "../ports/received-webhook-store.port";
import type { InboundWebhookReceiverPort, ReceiveWebhookInput, WebhookReception } from "../ports/inbound-webhook-receiver.port";
import type { WebhookFailureReaderPort } from "../ports/webhook-failure-reader.port";
import { RECEIVED_WEBHOOK_STORE, WEBHOOK_FAILURE_READER } from "../ports/webhooks-inbound.tokens";

/**
 * How long a PROCESSING claim holds its delivery. Every owner's handler is one short transaction, so a
 * claim this old belongs to a request that died; the next redelivery takes it over.
 */
export const RECEIVED_WEBHOOK_CLAIM_LEASE_MS = 300_000;

/** What a provider retrying a delivery that is being processed right now is answered (409: retry later). */
export function deliveryInProgress(): ConflictError {
	return new ConflictError({ message: "This webhook delivery is being processed; retry it later." });
}

const NOT_CONFIGURED_SUMMARY = "No key for this provider is configured on this server";

/** The request's correlation id (its HTTP audit row); null for an actor with no request. */
function correlationIdOf(actor: ActorContext): string | null {
	return actor.kind === "system" ? null : actor.request.requestId;
}

@Injectable()
export class InboundWebhookReceiver implements InboundWebhookReceiverPort {
	private readonly logger: Logger = new Logger(InboundWebhookReceiver.name);

	public constructor(
		@Inject(RECEIVED_WEBHOOK_STORE) private readonly store: ReceivedWebhookStorePort,
		@Inject(WEBHOOK_FAILURE_READER) private readonly failures: WebhookFailureReaderPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async receive<TResult>(input: ReceiveWebhookInput<TResult>): Promise<WebhookReception<TResult>> {
		const facts = this.factsOf(input);
		if (input.verifier === null) {
			throw await this.refuse(facts, "NOT_CONFIGURED", NOT_CONFIGURED_SUMMARY, input.notConfigured());
		}
		const check = input.verifier.verify(input.request);
		if (check.verdict !== "VALID") {
			throw await this.refuse(facts, check.verdict, check.reason, input.rejected(check));
		}
		const envelope = input.profile.envelopeOf(input.request);
		const claim = await this.store.claim({
			...facts,
			providerDeliveryId: envelope.deliveryId,
			eventType: envelope.eventType,
			staleClaimBefore: facts.receivedAt - RECEIVED_WEBHOOK_CLAIM_LEASE_MS,
		});
		if (claim.kind === "in_flight") {
			throw deliveryInProgress();
		}
		if (claim.kind === "duplicate") {
			return { kind: "duplicate" };
		}
		try {
			const handling = await input.handle(envelope);
			await this.complete({
				id: claim.id,
				outcome: handling.outcome,
				httpStatus: input.successStatus,
				eventType: handling.eventType ?? null,
				errorSummary: null,
				completedAt: this.clock.now(),
			});
			return { kind: "handled", ...handling };
		} catch (error) {
			const thrown = error instanceof Error ? error : new Error("webhook handler failed");
			const failure = this.failures.read(thrown);
			const outcome: CompletedWebhookOutcome = failure.httpStatus >= HTTP_SERVER_ERROR_MIN_STATUS ? "FAILED" : "REJECTED";
			await this.complete({ id: claim.id, outcome, httpStatus: failure.httpStatus, eventType: null, errorSummary: failure.summary, completedAt: this.clock.now() });
			throw thrown;
		}
	}

	private factsOf<TResult>(input: ReceiveWebhookInput<TResult>): ReceivedWebhookFacts {
		const { rawBody, headers } = input.request;
		return {
			provider: input.profile.provider,
			payloadSha256: createHash("sha256").update(rawBody).digest("hex"),
			payloadBytes: rawBody.length,
			headers: keptHeaders(headers),
			correlationId: correlationIdOf(input.actor),
			receivedAt: this.clock.now(),
		};
	}

	/** Logs a refused request and answers the error its route throws. */
	private async refuse(facts: ReceivedWebhookFacts, verification: RefusedWebhookRecord["verification"], reason: string, answer: Error): Promise<Error> {
		const record: RefusedWebhookRecord = { ...facts, verification, httpStatus: this.failures.read(answer).httpStatus, errorSummary: reason };
		try {
			await this.store.recordRefused(record);
		} catch (error) {
			// The refusal stands whether or not it was logged: a lost log row must not turn a 401/403/503 into a 500.
			this.logger.error({
				event: "webhooks.inbound.refusal_not_logged",
				provider: facts.provider,
				verification,
				...caughtErrorLogFields(error instanceof Error ? error : undefined),
			});
		}
		return answer;
	}

	/**
	 * Records a claimed delivery's end. The owner's work is already committed, so a lost write is logged,
	 * not thrown: rethrowing would make the provider redeliver work that is done (the stale claim is
	 * taken over by a redelivery and the owner's idempotent handler answers it again).
	 */
	private async complete(completion: DeliveryCompletion): Promise<void> {
		try {
			await this.store.complete(completion);
		} catch (error) {
			this.logger.error({
				event: "webhooks.inbound.outcome_not_logged",
				receivedWebhookId: completion.id,
				outcome: completion.outcome,
				...caughtErrorLogFields(error instanceof Error ? error : undefined),
			});
		}
	}
}
