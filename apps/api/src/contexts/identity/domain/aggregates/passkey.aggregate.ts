import { PasskeyNameSchema, type EpochMs, type PasskeyDeviceType, type PasskeyTransport } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";
import { PasskeyNameInvalidError, PasskeyVerificationFailedError } from "../errors/identity.errors";
import type { IdentityEvent } from "../events/identity.events";

/** What a verified registration ceremony proved about a new credential (attestation "none", ADR 080). */
export interface VerifiedPasskeyCredential {
	readonly credentialId: string;
	/** The COSE public key, base64url. */
	readonly publicKey: string;
	readonly counter: number;
	readonly transports: readonly PasskeyTransport[];
	readonly deviceType: PasskeyDeviceType;
	readonly backedUp: boolean;
	readonly aaguid: string;
}

/** What a verified sign-in assertion reported. */
export interface PasskeyAssertion {
	readonly newCounter: number;
	readonly backedUp: boolean;
}

export interface PasskeyState extends VerifiedPasskeyCredential {
	readonly id: string;
	readonly userId: string;
	readonly name: string;
	readonly createdAt: EpochMs;
	readonly lastUsedAt: EpochMs | null;
}

/** A write the repository applies, each one conditionally (compare-and-set). */
export type PasskeyChange =
	| { readonly kind: "renamed"; readonly name: string; readonly at: EpochMs }
	| { readonly kind: "used"; readonly previousCounter: number; readonly counter: number; readonly backedUp: boolean; readonly at: EpochMs }
	| { readonly kind: "removed"; readonly by: string; readonly at: EpochMs };

function validName(name: string): string {
	const parsed = PasskeyNameSchema.safeParse(name);
	if (!parsed.success) {
		throw new PasskeyNameInvalidError();
	}
	return parsed.data;
}

/**
 * One passkey (WebAuthn credential) of one account (ADR 080).
 *
 * The signature counter only moves forward: an assertion whose counter is not above the stored one
 * (while either is non-zero) is refused as a possibly cloned authenticator, and the repository writes the
 * new counter with a compare-and-set on the counter it read, so two concurrent uses cannot both pass.
 * A removed passkey is never loaded again (repositories return live passkeys only).
 */
export class Passkey extends AggregateRoot<IdentityEvent> {
	private readonly changes: PasskeyChange[] = [];

	private constructor(private state: PasskeyState) {
		super();
	}

	public static register(
		input: { readonly id: string; readonly userId: string; readonly name: string; readonly credential: VerifiedPasskeyCredential },
		now: EpochMs,
	): Passkey {
		return new Passkey({ ...input.credential, id: input.id, userId: input.userId, name: validName(input.name), createdAt: now, lastUsedAt: null });
	}

	public static rehydrate(state: PasskeyState): Passkey {
		if (state.counter < 0 || !Number.isSafeInteger(state.counter) || state.credentialId.length === 0 || state.publicKey.length === 0) {
			throw new CorruptAggregateStateError("passkey", state.id, "the credential id, public key or signature counter is invalid");
		}
		return new Passkey(state);
	}

	public get id(): string {
		return this.state.id;
	}

	public get userId(): string {
		return this.state.userId;
	}

	public get credentialId(): string {
		return this.state.credentialId;
	}

	public get name(): string {
		return this.state.name;
	}

	public get snapshot(): PasskeyState {
		return this.state;
	}

	public get pendingChanges(): readonly PasskeyChange[] {
		return this.changes;
	}

	/** Whether an assertion's signature counter may follow the stored one (see {@link Passkey.recordUse}). */
	public acceptsCounter(newCounter: number): boolean {
		const countsUses: boolean = newCounter > 0 || this.state.counter > 0;
		return !countsUses || newCounter > this.state.counter;
	}

	public isOwnedBy(userId: string): boolean {
		return this.state.userId === userId;
	}

	public rename(name: string, now: EpochMs): void {
		const next: string = validName(name);
		this.state = { ...this.state, name: next };
		this.changes.push({ kind: "renamed", name: next, at: now });
	}

	/** The owner (or a completed MFA recovery's reviewer) removes it: soft delete, attributed to `by`. */
	public remove(by: string, now: EpochMs): void {
		this.changes.push({ kind: "removed", by, at: now });
	}

	/**
	 * A verified assertion signed in with it. Refuses a counter that did not move forward while either
	 * counter is non-zero (WebAuthn L3 §6.1.1: a possibly cloned authenticator); authenticators without a
	 * counter (synced passkeys) report 0 every time and stay at 0.
	 */
	public recordUse(assertion: PasskeyAssertion, now: EpochMs): void {
		const previousCounter: number = this.state.counter;
		if (!this.acceptsCounter(assertion.newCounter)) {
			throw new PasskeyVerificationFailedError();
		}
		this.state = { ...this.state, counter: assertion.newCounter, backedUp: assertion.backedUp, lastUsedAt: now };
		this.changes.push({ kind: "used", previousCounter, counter: assertion.newCounter, backedUp: assertion.backedUp, at: now });
	}
}
