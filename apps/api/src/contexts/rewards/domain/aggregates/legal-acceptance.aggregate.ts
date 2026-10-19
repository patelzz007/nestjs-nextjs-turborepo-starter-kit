import type { EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import type { DomainEvent } from "../../../../platform/domain/domain-event";
import { LegalVersionBlankError } from "../errors/reward.errors";

/** What one acceptance records. */
export interface LegalAcceptanceRecord {
	readonly userId: string;
	readonly termsVersion: string;
	readonly privacyVersion: string;
	readonly acceptedAt: EpochMs;
}

/**
 * A customer's acceptance of one version of the rewards terms and privacy policy. Append-only:
 * every acceptance is its own row (a re-acceptance of a newer version keeps the history).
 */
export class LegalAcceptance extends AggregateRoot<DomainEvent> {
	private constructor(private readonly acceptance: LegalAcceptanceRecord) {
		super();
	}

	public static accept(userId: string, termsVersion: string, privacyVersion: string, now: EpochMs): LegalAcceptance {
		if (termsVersion.length === 0 || privacyVersion.length === 0) {
			throw new LegalVersionBlankError();
		}
		return new LegalAcceptance({ userId, termsVersion, privacyVersion, acceptedAt: now });
	}

	public snapshot(): LegalAcceptanceRecord {
		return this.acceptance;
	}
}
