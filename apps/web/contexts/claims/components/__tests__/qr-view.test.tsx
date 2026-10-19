// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Envelope, RewardClaimResponse, RewardClaimStatus } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CLAIM_QR_LOADING_LABELS } from "@/components/loading/loading-labels";
import { ClaimQrView } from "@/contexts/claims/components/qr-view";
import { buildRewardClaimResponse } from "@/test-support/claim";
import { testEnvelope } from "@/test-support/envelope";
import { expectSingleLoadingStatus } from "@/test-support/skeleton";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { resolveWebTrail } from "@/lib/navigation/breadcrumb";
import { ROUTES, walletClaimPath } from "@/lib/routes";

/** Only the issued-code fields the view reads. */
interface ClaimQrStub {
	readonly qrPayload: string;
	readonly backupCode: string;
	readonly claimExpiresAt: number;
}

/** The `claims.get` query state the view reads. */
interface ClaimQueryStub {
	readonly data: Envelope<RewardClaimResponse> | undefined;
	readonly isLoading: boolean;
}

/** The `claims.qr` mutation state the view reads. */
interface ClaimQrMutationStub {
	readonly mutate: (input: { readonly claimId: string }) => void;
	readonly data: { readonly data: ClaimQrStub } | undefined;
	readonly isPending: boolean;
	readonly isError: boolean;
}

/** What the view passes as `claims.get` query options (the prefetched envelope, if any). */
interface ClaimQueryOptionsStub {
	readonly initialData?: Envelope<RewardClaimResponse>;
}

const CLAIM_ID = "00000000-0000-4000-8000-0000000000c1";
const CLAIM_EXPIRES_AT = 1_786_300_000_000;
const ISSUED_CODES: ClaimQrStub = { qrPayload: "payload-1", backupCode: "ABC123", claimExpiresAt: CLAIM_EXPIRES_AT };

const { claimUseQuery, qrUseMutation, issueCodes } = vi.hoisted(() => ({
	claimUseQuery: vi.fn<(input: { readonly claimId: string }, options: ClaimQueryOptionsStub) => ClaimQueryStub>(),
	qrUseMutation: vi.fn<() => ClaimQrMutationStub>(),
	issueCodes: vi.fn<(input: { readonly claimId: string }) => void>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): {
		readonly api: { readonly claims: { readonly get: { readonly useQuery: typeof claimUseQuery }; readonly qr: { readonly useMutation: typeof qrUseMutation } } };
	} => ({
		api: { claims: { get: { useQuery: claimUseQuery }, qr: { useMutation: qrUseMutation } } },
	}),
}));

function claimEnvelope(status: RewardClaimStatus = "PENDING"): Envelope<RewardClaimResponse> {
	return testEnvelope(buildRewardClaimResponse({ id: CLAIM_ID, rewardTitle: "Free coffee", status }));
}

function claimLoaded(envelope: Envelope<RewardClaimResponse> | undefined): ClaimQueryStub {
	return { data: envelope, isLoading: false };
}

function qrState(overrides: Partial<Omit<ClaimQrMutationStub, "mutate">> = {}): ClaimQrMutationStub {
	return { mutate: issueCodes, data: undefined, isPending: false, isError: false, ...overrides };
}

function codesIssued(): ClaimQrMutationStub {
	return qrState({ data: { data: ISSUED_CODES } });
}

/** The claim page's breadcrumb, as the shell renders it: `[My Wallet, <this page>]`. */
function claimTrailLabels(): readonly string[] {
	return resolveWebTrail(walletClaimPath(CLAIM_ID)).map((crumb) => crumb.label);
}

beforeEach(() => {
	claimUseQuery.mockReturnValue(claimLoaded(claimEnvelope()));
	qrUseMutation.mockReturnValue(codesIssued());
});

afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});

describe("ClaimQrView", () => {
	it("titles the page like its final breadcrumb and shows the claim card with the issued codes", () => {
		render(<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope()} />);

		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(claimTrailLabels().at(-1));
		expect(screen.getByText("Free coffee")).toBeDefined();
		expect(screen.getByText("ABC123")).toBeDefined();
		expect(screen.getByRole("img", { name: "Reward redemption QR code" })).toBeDefined();
	});

	it("seeds the claim query with the server-prefetched claim", () => {
		const initialClaim = claimEnvelope();
		render(<ClaimQrView claimId={CLAIM_ID} initialClaim={initialClaim} />);

		expect(claimUseQuery).toHaveBeenCalledWith({ claimId: CLAIM_ID }, expect.objectContaining({ initialData: initialClaim }));
	});

	it("links back to the wallet with the parent breadcrumb's name", () => {
		render(<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope()} />);

		const parentLabel = claimTrailLabels().at(0);
		expect(parentLabel).toBe("My Wallet");
		const back = screen.getByRole("link", { name: `Back to ${parentLabel ?? ""}` });
		expect(back.getAttribute("href")).toBe(ROUTES.dashboard.wallet);
	});

	it("issues the codes once on mount for a PENDING claim", () => {
		render(<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope()} />);

		expect(issueCodes).toHaveBeenCalledTimes(1);
		expect(issueCodes).toHaveBeenCalledWith({ claimId: CLAIM_ID });
	});

	it("issues the codes once when React StrictMode mounts the view twice", () => {
		render(
			<React.StrictMode>
				<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope()} />
			</React.StrictMode>,
		);

		expect(issueCodes).toHaveBeenCalledTimes(1);
	});

	it("does not issue codes again when the view re-renders", () => {
		const { rerender } = render(<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope()} />);
		rerender(<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope()} />);

		expect(issueCodes).toHaveBeenCalledTimes(1);
	});

	it("issues a fresh pair of codes when Refresh code is pressed", () => {
		render(<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope()} />);

		fireEvent.click(screen.getByRole("button", { name: "Refresh code" }));

		expect(issueCodes).toHaveBeenCalledTimes(2);
		expect(issueCodes).toHaveBeenLastCalledWith({ claimId: CLAIM_ID });
	});

	it.each<[Exclude<RewardClaimStatus, "PENDING">, string]>([
		["REDEEMED", "This claim was already redeemed."],
		["EXPIRED", "This claim has expired."],
	])("never issues codes for a %s claim and says why it has none", (status, description) => {
		claimUseQuery.mockReturnValue(claimLoaded(claimEnvelope(status)));
		qrUseMutation.mockReturnValue(qrState());
		render(<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope(status)} />);

		expect(issueCodes).not.toHaveBeenCalled();
		expect(screen.getByRole("heading", { name: "Claim unavailable" })).toBeDefined();
		expect(screen.getByText(description)).toBeDefined();
	});

	it("keeps the claim card and a QR-sized skeleton, announced once, while the codes are being issued", () => {
		qrUseMutation.mockReturnValue(qrState({ isPending: true }));
		render(<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope()} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Free coffee")).toBeDefined();
		expectSingleLoadingStatus(CLAIM_QR_LOADING_LABELS.loading);
		expect(screen.queryByRole("img", { name: "Reward redemption QR code" })).toBeNull();
		expect(screen.getByRole("button", { name: "Refreshing…" }).hasAttribute("disabled")).toBe(true);
	});

	it("shows the page skeleton, announced once, while the claim loads without a prefetched copy", () => {
		claimUseQuery.mockReturnValue({ data: undefined, isLoading: true });
		qrUseMutation.mockReturnValue(qrState());
		render(<ClaimQrView claimId={CLAIM_ID} />, { wrapper: UiKitTestProviders });

		expectSingleLoadingStatus(CLAIM_QR_LOADING_LABELS.loading);
		expect(screen.queryByRole("heading", { name: "Claim unavailable" })).toBeNull();
		expect(issueCodes).not.toHaveBeenCalled();
	});

	it("offers the way back to the wallet when issuing the codes fails", () => {
		qrUseMutation.mockReturnValue(qrState({ isError: true }));
		render(<ClaimQrView claimId={CLAIM_ID} initialClaim={claimEnvelope()} />);

		expect(screen.getByRole("heading", { name: "Claim unavailable" })).toBeDefined();
		expect(screen.getByRole("link", { name: "Back to My Wallet" }).getAttribute("href")).toBe(ROUTES.dashboard.wallet);
	});

	it("offers the way back to the wallet when the claim cannot be read", () => {
		claimUseQuery.mockReturnValue(claimLoaded(undefined));
		qrUseMutation.mockReturnValue(qrState());
		render(<ClaimQrView claimId={CLAIM_ID} />);

		expect(screen.getByRole("heading", { name: "Claim unavailable" })).toBeDefined();
		expect(issueCodes).not.toHaveBeenCalled();
	});
});
