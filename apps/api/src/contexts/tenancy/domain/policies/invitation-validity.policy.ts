import { epochMs, type EpochMs, type TenantInvitationKind, type TenantInvitationStatus } from "@workspace/shared";

import { MerchantInviteExpiredError, OnboardingDocumentsClosedError, TeamInviteExpiredError } from "../errors/tenants.errors";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days a team invitation stays valid. */
export const TEAM_INVITE_TTL_DAYS = 7;
/** Days a merchant onboarding invitation stays valid. */
export const ONBOARDING_INVITE_TTL_DAYS = 7;

export const TEAM_INVITE_TTL_MS = TEAM_INVITE_TTL_DAYS * MS_PER_DAY;
export const ONBOARDING_INVITE_TTL_MS = ONBOARDING_INVITE_TTL_DAYS * MS_PER_DAY;

/**
 * How long after accepting the onboarding invite its token may still be used
 * for KYB documents (upload tickets, completions, one submission). After that,
 * or after the submission consumed it, the merchant uses the signed-in KYB flow.
 */
export const ONBOARDING_DOCUMENTS_WINDOW_MS = MS_PER_DAY;

/** Team invite links stop working once `expiresAt` is in the past. */
export function assertTeamInviteNotExpired(expiresAt: EpochMs, now: EpochMs): void {
	if (expiresAt < now) {
		throw new TeamInviteExpiredError();
	}
}

/** Onboarding links stop working at `expiresAt`. */
export function assertOnboardingInviteNotExpired(expiresAt: EpochMs, now: EpochMs): void {
	if (expiresAt <= now) {
		throw new MerchantInviteExpiredError();
	}
}

/** The earliest acceptance time whose document window is still open at `now`. */
export function documentsWindowStart(now: EpochMs): EpochMs {
	return epochMs(Math.max(0, now - ONBOARDING_DOCUMENTS_WINDOW_MS));
}

/** The facts the onboarding document window depends on. */
export interface DocumentsWindowFacts {
	readonly kind: TenantInvitationKind;
	readonly status: TenantInvitationStatus;
	readonly acceptedByUserId: string | null;
	readonly acceptedAt: EpochMs | null;
	readonly documentsSubmittedAt: EpochMs | null;
}

/** Open only for an accepted onboarding invite, within the window of its acceptance, until one submission consumed it. */
export function documentsWindowOpen(facts: DocumentsWindowFacts, now: EpochMs): boolean {
	return (
		facts.kind === "PLATFORM_ONBOARDING" &&
		facts.status === "ACCEPTED" &&
		facts.acceptedByUserId !== null &&
		facts.acceptedAt !== null &&
		facts.acceptedAt >= documentsWindowStart(now) &&
		facts.documentsSubmittedAt === null
	);
}

/** Throws {@link OnboardingDocumentsClosedError} unless the document window is open. */
export function assertDocumentsWindowOpen(facts: DocumentsWindowFacts, now: EpochMs): void {
	if (!documentsWindowOpen(facts, now)) {
		throw new OnboardingDocumentsClosedError();
	}
}
