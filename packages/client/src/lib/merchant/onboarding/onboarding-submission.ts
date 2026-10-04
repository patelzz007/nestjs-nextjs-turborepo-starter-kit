import { CaughtValueSchema, type CaughtValue } from "@workspace/shared";

import { classifyOnboardingFailure, type OnboardingFailure } from "./onboarding-outcome";

/**
 * The final onboarding submit is two API steps: `complete` (account, profile,
 * stores — claims the invite, so it succeeds exactly once) and the documents.
 * If the documents fail after `complete` succeeded, a retry must go straight
 * to the documents: calling `complete` again answers 409
 * MERCHANT_INVITE_UNAVAILABLE. This runs the steps in order, skips `complete`
 * once it is known to have succeeded, and turns every failure into an
 * {@link OnboardingFailure}.
 */

export interface OnboardingSubmissionSteps {
	/** `POST /orgs/onboarding/complete`; resolves with the business name. */
	readonly completeApplication: () => Promise<string>;
	/** Uploads and attaches the documents through the onboarding link. */
	readonly submitDocuments: () => Promise<void>;
}

export type OnboardingSubmissionResult =
	| { readonly kind: "submitted"; readonly businessName: string | undefined }
	| { readonly kind: "failed"; readonly failure: OnboardingFailure; readonly isApplicationSubmitted: boolean };

async function settle<T>(promise: Promise<T>): Promise<{ readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: CaughtValue }> {
	try {
		return { ok: true, value: await promise };
	} catch (error) {
		const caught = CaughtValueSchema.safeParse(error);
		return { ok: false, error: caught.success ? caught.data : undefined };
	}
}

/**
 * Runs the submission. `isApplicationSubmitted` = `complete` already succeeded
 * in an earlier attempt (or answered "already used"), so only the documents run.
 */
export async function runOnboardingSubmission(steps: OnboardingSubmissionSteps, isApplicationSubmitted: boolean): Promise<OnboardingSubmissionResult> {
	let businessName: string | undefined;
	if (!isApplicationSubmitted) {
		const completed = await settle(steps.completeApplication());
		if (completed.ok) {
			businessName = completed.value;
		} else {
			const failure = classifyOnboardingFailure(completed.error);
			if (failure.kind !== "already-submitted") {
				return { kind: "failed", failure, isApplicationSubmitted: false };
			}
		}
	}

	const documents = await settle(steps.submitDocuments());
	if (!documents.ok) {
		return { kind: "failed", failure: classifyOnboardingFailure(documents.error), isApplicationSubmitted: true };
	}
	return { kind: "submitted", businessName };
}
