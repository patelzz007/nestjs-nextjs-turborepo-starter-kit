import { epochMs, type EpochMs } from "@workspace/shared";

import { CLAIM_HOLD_TTL_MS, type ClaimHoldStatus } from "../value-objects/claim-rules.value-object";

/** A hold's stored state. */
export interface ClaimHoldState {
	readonly id: string;
	readonly userId: string;
	readonly rewardId: string;
	readonly status: ClaimHoldStatus;
	readonly expiresAt: EpochMs;
	readonly settledAt: EpochMs | null;
}

/**
 * One unit of a reward held for one customer while they enter their claim code, like a seat held at a
 * cinema. `ACTIVE → CONVERTED` when the claim takes the unit, `ACTIVE → EXPIRED` when the time runs out
 * and the unit goes back. Asking for another code never extends a hold.
 */
export class ClaimHold {
	private constructor(private state: ClaimHoldState) {}

	public static place(id: string, userId: string, rewardId: string, now: EpochMs): ClaimHold {
		return new ClaimHold({ id, userId, rewardId, status: "ACTIVE", expiresAt: epochMs(now + CLAIM_HOLD_TTL_MS), settledAt: null });
	}

	public static rehydrate(state: ClaimHoldState): ClaimHold {
		return new ClaimHold(state);
	}

	public get id(): string {
		return this.state.id;
	}

	public get rewardId(): string {
		return this.state.rewardId;
	}

	public get expiresAt(): EpochMs {
		return this.state.expiresAt;
	}

	/** Whether the hold's time has run out while it still holds the unit. */
	public isOverdue(now: EpochMs): boolean {
		return this.state.status === "ACTIVE" && this.state.expiresAt < now;
	}

	/** The claim takes the held unit. */
	public convert(now: EpochMs): void {
		this.state = { ...this.state, status: "CONVERTED", settledAt: now };
	}

	/** The time ran out; the caller returns the unit. */
	public expire(now: EpochMs): void {
		this.state = { ...this.state, status: "EXPIRED", settledAt: now };
	}

	public snapshot(): ClaimHoldState {
		return this.state;
	}
}
