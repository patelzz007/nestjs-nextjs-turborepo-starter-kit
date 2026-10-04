import { epochMs, type KybDocumentScanStatus, type MerchantKybDocumentRecord, type MerchantOnboardingDocumentStatusResponse } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/use-api";
import { pollOnboardingDocumentStatus, type OnboardingDocumentStatusReader, type OnboardingDocumentStatusState } from "./use-onboarding-document-status";

const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const FAST = { initialDelayMs: 1, maxDelayMs: 1 };

function document(scanStatus: KybDocumentScanStatus): MerchantKybDocumentRecord {
	return { id: FILE_ID, fileName: "registration.pdf", mimeType: "application/pdf", sizeBytes: 2048, scanStatus, uploadedAt: epochMs(0) };
}

function reader(answers: readonly (KybDocumentScanStatus | Error)[]): OnboardingDocumentStatusReader & { readonly mutate: ReturnType<typeof vi.fn> } {
	let index = 0;
	const mutate = vi.fn((): Promise<{ readonly data: MerchantOnboardingDocumentStatusResponse }> => {
		const answer = answers[Math.min(index, answers.length - 1)] ?? "CLEAN";
		index += 1;
		return answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ data: { documents: [document(answer)] } });
	});
	return { mutate, organizations: { onboarding: { documentStatus: { mutate } } } };
}

async function run(answers: readonly (KybDocumentScanStatus | Error)[]): Promise<{ readonly states: OnboardingDocumentStatusState[]; readonly calls: number }> {
	const states: OnboardingDocumentStatusState[] = [];
	const api = reader(answers);
	await pollOnboardingDocumentStatus(
		api,
		"onboarding-token",
		[FILE_ID],
		(state: OnboardingDocumentStatusState): void => {
			states.push(state);
		},
		FAST,
	);
	return { states, calls: api.mutate.mock.calls.length };
}

describe("pollOnboardingDocumentStatus", () => {
	it("polls while a document is SCANNING and stops at the verdict", async () => {
		const { states, calls } = await run(["SCANNING", "SCANNING", "NOT_SCANNED"]);

		expect(calls).toBe(3);
		expect(states.at(-1)).toEqual({ kind: "settled", documents: [document("NOT_SCANNED")] });
		expect(states.slice(0, -1).every((state) => state.kind === "polling")).toBe(true);
	});

	it.each<KybDocumentScanStatus>(["CLEAN", "INFECTED", "SCAN_FAILED"])("settles at once on %s", async (status: KybDocumentScanStatus) => {
		const { states, calls } = await run([status]);

		expect(calls).toBe(1);
		expect(states).toEqual([{ kind: "settled", documents: [document(status)] }]);
	});

	it("turns a closed onboarding window (410) into the typed closed state", async () => {
		const closed = new ApiError({ message: "Onboarding is closed", error: "MERCHANT_ONBOARDING_DOCUMENTS_CLOSED", statusCode: 410 });

		const { states } = await run(["SCANNING", closed]);

		expect(states.at(-1)).toEqual({ kind: "closed" });
	});

	it("reports any other failure", async () => {
		const { states } = await run([new Error("offline")]);

		expect(states).toEqual([{ kind: "failed", message: "offline" }]);
	});
});
