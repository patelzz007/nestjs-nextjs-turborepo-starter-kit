"use client";

import type { MerchantKybDocumentRecord, MerchantOnboardingDocumentStatusResponse } from "@workspace/shared";
import { useEffect, useState } from "react";

import { ApiError } from "../../api/use-api";
import { useAuth } from "../../auth/index";
import { pollWithBackoff, type PollingOptions, type PollVerdict } from "../../storage/direct-upload";

/** HTTP status / code of `POST /orgs/onboarding/documents/status` once the onboarding window has closed. */
const DOCUMENTS_CLOSED_STATUS = 410;
const DOCUMENTS_CLOSED_CODE = "MERCHANT_ONBOARDING_DOCUMENTS_CLOSED";

/**
 * Where the onboarding document scan stands:
 * - `polling` — at least one document is still SCANNING (`documents` = latest answer, empty before the first);
 * - `settled` — no document is SCANNING any more (each has its final verdict);
 * - `closed` — the onboarding window closed (410): the member continues signed
 *   in, on the organization's verification page;
 * - `failed` — the poll gave up (timeout, network) — `message` says why.
 */
export type OnboardingDocumentStatusState =
	| { readonly kind: "polling"; readonly documents: readonly MerchantKybDocumentRecord[] }
	| { readonly kind: "settled"; readonly documents: readonly MerchantKybDocumentRecord[] }
	| { readonly kind: "closed" }
	| { readonly kind: "failed"; readonly message: string };

/** The status call the poll needs (`useAuth().api` satisfies it). */
export interface OnboardingDocumentStatusReader {
	readonly organizations: {
		readonly onboarding: {
			readonly documentStatus: {
				readonly mutate: (input: { readonly token: string; readonly fileIds: string[] }) => Promise<{ readonly data: MerchantOnboardingDocumentStatusResponse }>;
			};
		};
	};
}

function isDocumentsClosedError(error: Error): boolean {
	return error instanceof ApiError && (error.statusCode === DOCUMENTS_CLOSED_STATUS || error.code === DOCUMENTS_CLOSED_CODE);
}

/**
 * Polls the onboarding documents' scan status with the package's bounded
 * backoff (`pollWithBackoff`, the same policy as `waitForFileReady`) until no
 * document is SCANNING. Reports every intermediate answer through `onUpdate`.
 */
export async function pollOnboardingDocumentStatus(
	api: OnboardingDocumentStatusReader,
	token: string,
	fileIds: readonly string[],
	onUpdate: (state: OnboardingDocumentStatusState) => void,
	options: PollingOptions = {},
): Promise<void> {
	try {
		const final = await pollWithBackoff(
			async (): Promise<readonly MerchantKybDocumentRecord[]> => (await api.organizations.onboarding.documentStatus.mutate({ token, fileIds: [...fileIds] })).data.documents,
			(documents: readonly MerchantKybDocumentRecord[]): PollVerdict<readonly MerchantKybDocumentRecord[]> =>
				documents.some((document: MerchantKybDocumentRecord): boolean => document.scanStatus === "SCANNING")
					? { kind: "continue", progress: documents }
					: { kind: "done", value: documents },
			options,
			(documents: readonly MerchantKybDocumentRecord[]): void => {
				onUpdate({ kind: "polling", documents });
			},
		);
		onUpdate({ kind: "settled", documents: final });
	} catch (error) {
		if (options.signal?.aborted === true) {
			return;
		}
		if (error instanceof Error && isDocumentsClosedError(error)) {
			onUpdate({ kind: "closed" });
			return;
		}
		onUpdate({ kind: "failed", message: error instanceof Error ? error.message : "The document status could not be loaded." });
	}
}

const INITIAL_STATE: OnboardingDocumentStatusState = { kind: "polling", documents: [] };

/**
 * The scan status of the documents uploaded during onboarding (no session —
 * the onboarding token authorizes it). Polls while any is SCANNING; a closed
 * onboarding window becomes the typed `closed` state.
 */
export function useOnboardingDocumentStatus(token: string, fileIds: readonly string[]): OnboardingDocumentStatusState {
	const { api } = useAuth();
	const [state, setState] = useState<OnboardingDocumentStatusState>(INITIAL_STATE);
	const fileIdsKey: string = fileIds.join(",");

	useEffect((): (() => void) => {
		const controller = new AbortController();
		const ids: readonly string[] = fileIdsKey.length === 0 ? [] : fileIdsKey.split(",");
		if (ids.length > 0) {
			void pollOnboardingDocumentStatus(api, token, ids, setState, { signal: controller.signal });
		}
		return (): void => {
			controller.abort();
		};
	}, [api, fileIdsKey, token]);

	return state;
}
