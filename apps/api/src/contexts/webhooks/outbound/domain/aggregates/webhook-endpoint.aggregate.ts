import {
	WebhookEndpointEventTypesSchema,
	type EpochMs,
	type WebhookEndpointDisabledReason,
	type WebhookEndpointStatus,
	type WebhookEventType,
	type WebhookSubscribableEventType,
} from "@workspace/shared";

import { AggregateRoot } from "../../../../../platform/domain/aggregate-root";
import { WebhookEndpointNotFoundError } from "../errors/webhooks.errors";
import { WebhookEndpointAutoDisabled, type WebhookEndpointEvent } from "../events/webhook.events";

/** Dead deliveries in a row after which an endpoint turns itself off (ADR 082): about a day of every attempt failing. */
export const WEBHOOK_ENDPOINT_AUTO_DISABLE_THRESHOLD = 5;

/** A signing secret as stored: encrypted, with the last characters that tell it apart. */
export interface SealedWebhookSecret {
	readonly ciphertext: string;
	readonly hint: string;
}

/** Everything the aggregate holds, as the repository reads and writes it. */
export interface WebhookEndpointState {
	readonly id: string;
	readonly tenantId: string;
	readonly url: string;
	readonly description: string;
	readonly eventTypes: readonly WebhookSubscribableEventType[];
	readonly status: WebhookEndpointStatus;
	readonly disabledReason: WebhookEndpointDisabledReason | null;
	readonly disabledAt: EpochMs | null;
	readonly secret: SealedWebhookSecret;
	readonly previousSecretCiphertext: string | null;
	readonly previousSecretExpiresAt: EpochMs | null;
	readonly consecutiveFailures: number;
	readonly lastDeliveryAt: EpochMs | null;
	readonly createdByUserId: string;
	/** The version this state was read at (compare-and-set on save). */
	readonly version: number;
	readonly createdAt: EpochMs;
	readonly updatedAt: EpochMs;
	readonly isDeleted: boolean;
	readonly deletedAt: EpochMs | null;
}

export interface NewWebhookEndpoint {
	readonly id: string;
	readonly tenantId: string;
	readonly url: string;
	readonly description: string;
	readonly eventTypes: readonly WebhookSubscribableEventType[];
	readonly secret: SealedWebhookSecret;
	readonly createdByUserId: string;
}

/** The fields a member may change; an absent field stays as it is. */
export interface WebhookEndpointDetails {
	readonly url?: string;
	readonly description?: string;
	readonly eventTypes?: readonly WebhookSubscribableEventType[];
}

/**
 * An integrator's endpoint (ADR 082). Invariants: it receives at least one catalog type, each once; a removed
 * endpoint never changes again; only an active endpoint receives deliveries; enabling it forgets past failures;
 * and after {@link WEBHOOK_ENDPOINT_AUTO_DISABLE_THRESHOLD} dead deliveries in a row it turns itself off
 * (recording {@link WebhookEndpointAutoDisabled}). Every change marks it dirty, and the repository saves it
 * as a compare-and-set on the version it was read at.
 */
export class WebhookEndpoint extends AggregateRoot<WebhookEndpointEvent> {
	private changed = false;

	private constructor(private state: WebhookEndpointState) {
		super();
	}

	public static register(input: NewWebhookEndpoint, now: EpochMs): WebhookEndpoint {
		const endpoint = new WebhookEndpoint({
			...input,
			eventTypes: WebhookEndpointEventTypesSchema.parse([...input.eventTypes]),
			status: "ACTIVE",
			disabledReason: null,
			disabledAt: null,
			previousSecretCiphertext: null,
			previousSecretExpiresAt: null,
			consecutiveFailures: 0,
			lastDeliveryAt: null,
			version: 0,
			createdAt: now,
			updatedAt: now,
			isDeleted: false,
			deletedAt: null,
		});
		endpoint.changed = true;
		return endpoint;
	}

	public static restore(state: WebhookEndpointState): WebhookEndpoint {
		return new WebhookEndpoint(state);
	}

	public get snapshot(): WebhookEndpointState {
		return this.state;
	}

	public get id(): string {
		return this.state.id;
	}

	/** Whether this unit of work changed it (a save is due). */
	public get isChanged(): boolean {
		return this.changed;
	}

	/** Whether a delivery of `type` goes to this endpoint now. A test is delivered to any active endpoint. */
	public receives(type: WebhookEventType): boolean {
		if (this.state.isDeleted || this.state.status !== "ACTIVE") {
			return false;
		}
		return type === "webhook.test" || this.state.eventTypes.some((subscribed: WebhookSubscribableEventType): boolean => subscribed === type);
	}

	public get isActive(): boolean {
		return !this.state.isDeleted && this.state.status === "ACTIVE";
	}

	/** The ciphertexts that sign a delivery now: the current secret, and the previous one during its grace. */
	public signingSecretCiphertexts(now: EpochMs): readonly string[] {
		const { secret, previousSecretCiphertext, previousSecretExpiresAt } = this.state;
		const previousStillSigns = previousSecretCiphertext !== null && previousSecretExpiresAt !== null && previousSecretExpiresAt > now;
		return previousStillSigns ? [secret.ciphertext, previousSecretCiphertext] : [secret.ciphertext];
	}

	/** Applies a member's edit; `false` when nothing actually changed. */
	public changeDetails(details: WebhookEndpointDetails, now: EpochMs): boolean {
		this.assertLive();
		const next = {
			url: details.url ?? this.state.url,
			description: details.description ?? this.state.description,
			eventTypes: details.eventTypes === undefined ? this.state.eventTypes : WebhookEndpointEventTypesSchema.parse([...details.eventTypes]),
		};
		const sameTypes = next.eventTypes.length === this.state.eventTypes.length && next.eventTypes.every((type, index) => this.state.eventTypes.at(index) === type);
		if (next.url === this.state.url && next.description === this.state.description && sameTypes) {
			return false;
		}
		this.apply({ ...next }, now);
		return true;
	}

	/** Switches it on; past failures are forgotten. `false` when it already was on. */
	public enable(now: EpochMs): boolean {
		this.assertLive();
		if (this.state.status === "ACTIVE") {
			return false;
		}
		this.apply({ status: "ACTIVE", disabledReason: null, disabledAt: null, consecutiveFailures: 0 }, now);
		return true;
	}

	/** A member switches it off. `false` when it already was off. */
	public disable(now: EpochMs): boolean {
		this.assertLive();
		if (this.state.status === "DISABLED") {
			return false;
		}
		this.apply({ status: "DISABLED", disabledReason: "MANUAL", disabledAt: now }, now);
		return true;
	}

	/**
	 * Replaces the signing secret. With `previousSignsUntil`, the old secret keeps signing (a second `v1=`)
	 * until then, so receivers can switch without dropping deliveries; `null` stops it at once.
	 */
	public rotateSecret(next: SealedWebhookSecret, previousSignsUntil: EpochMs | null, now: EpochMs): void {
		this.assertLive();
		this.apply(
			{
				secret: next,
				previousSecretCiphertext: previousSignsUntil === null ? null : this.state.secret.ciphertext,
				previousSecretExpiresAt: previousSignsUntil,
			},
			now,
		);
	}

	/** Soft-deletes it; its deliveries stay in the log. */
	public remove(now: EpochMs): void {
		this.assertLive();
		this.apply({ isDeleted: true, deletedAt: now }, now);
	}

	/** A delivery to it succeeded: the failure streak is over. */
	public recordDeliverySucceeded(now: EpochMs): void {
		this.apply({ consecutiveFailures: 0, lastDeliveryAt: now }, now);
	}

	/** A delivery to it gave up. At the threshold an active endpoint turns itself off. */
	public recordDeliveryDead(now: EpochMs): void {
		const consecutiveFailures = this.state.consecutiveFailures + 1;
		const turnsOff = this.isActive && consecutiveFailures >= WEBHOOK_ENDPOINT_AUTO_DISABLE_THRESHOLD;
		this.apply(
			turnsOff ? { consecutiveFailures, lastDeliveryAt: now, status: "DISABLED", disabledReason: "FAILING", disabledAt: now } : { consecutiveFailures, lastDeliveryAt: now },
			now,
		);
		if (turnsOff) {
			this.record(new WebhookEndpointAutoDisabled(now, this.state.id, this.state.tenantId, this.state.url, consecutiveFailures));
		}
	}

	private assertLive(): void {
		if (this.state.isDeleted) {
			throw new WebhookEndpointNotFoundError(this.state.id);
		}
	}

	private apply(change: Partial<Omit<WebhookEndpointState, "id" | "tenantId" | "createdByUserId" | "version" | "createdAt">>, now: EpochMs): void {
		this.state = { ...this.state, ...change, updatedAt: now };
		this.changed = true;
	}
}
