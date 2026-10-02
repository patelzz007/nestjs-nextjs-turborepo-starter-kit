// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClaimQrView } from "@/components/rewardhub/claims/qr-view";
import { resolveWebTrail } from "@/lib/navigation/breadcrumb";
import { ROUTES, walletClaimPath } from "@/lib/routes";

/** Only the QR fields the view reads. */
interface ClaimQrStub {
	readonly qrPayload: string;
	readonly backupCode: string;
	readonly claimExpiresAt: number;
}

interface ClaimQrQueryStub {
	readonly data: { readonly data: ClaimQrStub } | undefined;
	readonly isLoading: boolean;
	readonly isFetching: boolean;
	readonly refetch: () => Promise<void>;
}

const CLAIM_ID = "claim-1";
const CLAIM_EXPIRES_AT = 1_786_300_000_000;

const { qrUseQuery } = vi.hoisted(() => ({
	qrUseQuery: vi.fn<() => ClaimQrQueryStub>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): { readonly api: { readonly claims: { readonly qr: { readonly useQuery: typeof qrUseQuery } } } } => ({
		api: { claims: { qr: { useQuery: qrUseQuery } } },
	}),
}));

function queryResult(data: ClaimQrStub | undefined): ClaimQrQueryStub {
	return {
		data: data !== undefined ? { data } : undefined,
		isLoading: false,
		isFetching: false,
		refetch: (): Promise<void> => Promise.resolve(),
	};
}

/** The claim page's breadcrumb, as the shell renders it: `[My Wallet, <this page>]`. */
function claimTrailLabels(): readonly string[] {
	return resolveWebTrail(walletClaimPath(CLAIM_ID)).map((crumb) => crumb.label);
}

beforeEach(() => {
	qrUseQuery.mockReset();
});

afterEach(() => {
	cleanup();
});

describe("ClaimQrView", () => {
	it("titles the page like its final breadcrumb and shows the backup code", () => {
		qrUseQuery.mockReturnValue(queryResult({ qrPayload: "payload-1", backupCode: "ABC123", claimExpiresAt: CLAIM_EXPIRES_AT }));
		render(<ClaimQrView claimId={CLAIM_ID} />);

		expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(claimTrailLabels().at(-1));
		expect(screen.getByText("ABC123")).toBeDefined();
		expect(screen.getByRole("img", { name: "Reward redemption QR code" })).toBeDefined();
	});

	it("links back to the wallet with the parent breadcrumb's name", () => {
		qrUseQuery.mockReturnValue(queryResult({ qrPayload: "payload-1", backupCode: "ABC123", claimExpiresAt: CLAIM_EXPIRES_AT }));
		render(<ClaimQrView claimId={CLAIM_ID} />);

		const parentLabel = claimTrailLabels().at(0);
		expect(parentLabel).toBe("My Wallet");
		const back = screen.getByRole("link", { name: `← ${parentLabel ?? ""}` });
		expect(back.getAttribute("href")).toBe(ROUTES.rewardHub.wallet);
	});

	it("offers the way back to the wallet when the claim is unavailable", () => {
		qrUseQuery.mockReturnValue(queryResult(undefined));
		render(<ClaimQrView claimId={CLAIM_ID} />);

		expect(screen.getByRole("heading", { name: "Claim unavailable" })).toBeDefined();
		expect(screen.getByRole("link", { name: "Back to My Wallet" }).getAttribute("href")).toBe(ROUTES.rewardHub.wallet);
	});
});
