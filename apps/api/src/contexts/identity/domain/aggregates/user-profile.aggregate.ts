import type { EpochMs, OwnProfileEditableFields } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import { UserProfileChanged, type IdentityEvent } from "../events/identity.events";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/** The profile fields one edit writes; an absent field is left unchanged. */
export type OwnProfileChanges = Partial<OwnProfileEditableFields>;

export interface UserProfileState {
	readonly userId: string;
	readonly fullName: string;
	/** The optimistic-lock token of the self-service fields (`profileVersion`). */
	readonly version: number;
}

/**
 * The self-service part of an account (today: the full name). Edits are optimistic: they apply only
 * while the stored version still equals the version the client read, and move it forward (a
 * compare-and-set in storage; a stale version is a 409).
 */
export class UserProfile extends AggregateRoot<IdentityEvent> {
	private pendingChanges: OwnProfileChanges | null = null;
	private expected: number;

	private constructor(private state: UserProfileState) {
		super();
		this.expected = state.version;
	}

	public static rehydrate(state: UserProfileState): UserProfile {
		if (!Number.isInteger(state.version) || state.version < 0) {
			throw new CorruptAggregateStateError("user_profile", null, `profile ${state.userId} has an invalid version`);
		}
		return new UserProfile(state);
	}

	public get userId(): string {
		return this.state.userId;
	}

	/** The version the edit was based on (the client's), compared in storage. */
	public get concurrencyToken(): number {
		return this.expected;
	}

	public get changes(): OwnProfileChanges | null {
		return this.pendingChanges;
	}

	/** Applies an edit based on `expectedVersion` (what the client read). Who may edit is decided first (`assertOwnProfileWritable`). */
	public edit(expectedVersion: number, changes: OwnProfileChanges, now: EpochMs): void {
		this.expected = expectedVersion;
		this.pendingChanges = { ...(changes.fullName === undefined ? {} : { fullName: changes.fullName }) };
		this.state = { ...this.state, ...this.pendingChanges, version: expectedVersion + 1 };
		this.record(new UserProfileChanged(this.state.userId, now));
	}
}
