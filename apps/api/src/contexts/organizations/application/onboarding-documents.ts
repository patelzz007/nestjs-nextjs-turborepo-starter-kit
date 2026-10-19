import type { EpochMs } from "@workspace/shared";

import { OnboardingDocumentsClosedError } from "../domain/errors/organizations.errors";
import { assertDocumentsWindowOpen } from "../domain/policies/invitation-validity.policy";
import { isOwnKybUpload } from "./kyb-documents";
import { onboardingFileNotFound } from "./kyb-errors";
import type { KybFileAccessPort } from "./ports/kyb-files.port";
import type { KybReadPort, OnboardingInviteView } from "./ports/kyb-read.port";

/** An accepted onboarding invite whose document window is open, with the merchant who accepted it. */
export interface DocumentsWindowInvite extends OnboardingInviteView {
	readonly acceptedByUserId: string;
}

/**
 * Post-acceptance access for KYB documents through the onboarding token:
 * only within the document window of its acceptance and only until one
 * submission consumed it. Anything else is the same 410.
 */
export async function resolveDocumentsWindowInvite(kyb: KybReadPort, tokenHash: string, now: EpochMs): Promise<DocumentsWindowInvite> {
	const invite = await kyb.findOnboardingInvite(tokenHash, ["ACCEPTED"]);
	if (invite === null) {
		throw new OnboardingDocumentsClosedError();
	}
	assertDocumentsWindowOpen({ kind: "PLATFORM_ONBOARDING", ...invite }, now);
	const { acceptedByUserId } = invite;
	if (acceptedByUserId === null) {
		throw new OnboardingDocumentsClosedError();
	}
	return { ...invite, acceptedByUserId };
}

/** Onboarding tokens may only touch this organization's KYB uploads made by the merchant who accepted the invite. */
export async function assertOwnOnboardingUploads(files: KybFileAccessPort, invite: DocumentsWindowInvite, fileIds: readonly string[]): Promise<void> {
	const found = await files.describe(fileIds);
	for (const fileId of fileIds) {
		const file = found.find((candidate) => candidate.id === fileId);
		if (file === undefined || !isOwnKybUpload(file, invite.organizationId, invite.acceptedByUserId)) {
			throw onboardingFileNotFound();
		}
	}
}
