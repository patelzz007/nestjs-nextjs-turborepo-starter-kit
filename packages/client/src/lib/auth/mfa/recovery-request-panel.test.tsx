// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { Envelope, MfaRecoveryStatusResponse, UserResponse } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture, userFixture } from "../../../test/auth-fixtures";
import { MFA_RECOVERY_LOADING_LABELS, MFA_RECOVERY_STATUS_LOADING_LABELS, MfaRecoveryRequestPanel } from "./recovery-request-panel";

/** What a stubbed query answers. */
interface QueryState<Data> {
	readonly data: Data | undefined;
	readonly isPending: boolean;
}

const mocks = vi.hoisted(() => ({
	me: vi.fn<() => QueryState<Envelope<UserResponse>>>(),
	status: vi.fn<() => QueryState<Envelope<MfaRecoveryStatusResponse>>>(),
	noop: vi.fn<() => Promise<void>>(),
}));

vi.mock("../index", () => {
	const api = {
		auth: {
			me: { useQuery: (): QueryState<Envelope<UserResponse>> => mocks.me() },
			mfaRecoveryStatus: {
				useQuery: (): QueryState<Envelope<MfaRecoveryStatusResponse>> & { readonly refetch: typeof mocks.noop } => ({ ...mocks.status(), refetch: mocks.noop }),
			},
			mfaRecoveryInitiate: { useMutation: (): { readonly mutateAsync: typeof mocks.noop; readonly isPending: boolean } => ({ mutateAsync: mocks.noop, isPending: false }) },
		},
	};
	return { useAuth: (): { readonly api: typeof api } => ({ api }) };
});

const ENROLLED: QueryState<Envelope<UserResponse>> = { data: envelopeFixture(userFixture({ twoFactorEnabled: true })), isPending: false };
const NO_REQUEST: QueryState<Envelope<MfaRecoveryStatusResponse>> = {
	data: envelopeFixture({ status: "NONE", message: "You have no recovery request." }),
	isPending: false,
};

beforeEach((): void => {
	mocks.me.mockReturnValue(ENROLLED);
	mocks.status.mockReturnValue(NO_REQUEST);
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("MfaRecoveryRequestPanel loading", () => {
	it("draws the panel's shape — not the 'enroll first' notice — until the account answers", (): void => {
		mocks.me.mockReturnValue({ data: undefined, isPending: true });
		render(<MfaRecoveryRequestPanel />, { wrapper: UiKitTestProviders });

		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.textContent).toBe(MFA_RECOVERY_LOADING_LABELS.loading);
		expect(screen.queryByText(/available after you enroll/u)).toBeNull();
		expect(screen.queryByRole("button", { name: "Request MFA recovery" })).toBeNull();
	});

	it("shows a status-box skeleton while the current request loads, with the form ready", (): void => {
		mocks.status.mockReturnValue({ data: undefined, isPending: true });
		render(<MfaRecoveryRequestPanel />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("status").textContent).toBe(MFA_RECOVERY_STATUS_LOADING_LABELS.loading);
		expect(screen.getByRole("button", { name: "Request MFA recovery" })).toBeTruthy();
	});

	it("shows the request's status once both answers are in, with nothing busy", (): void => {
		render(<MfaRecoveryRequestPanel />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("No active request")).toBeTruthy();
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("explains enrollment comes first once the account says two-factor is off", (): void => {
		mocks.me.mockReturnValue({ data: envelopeFixture(userFixture({ twoFactorEnabled: false })), isPending: false });
		render(<MfaRecoveryRequestPanel />, { wrapper: UiKitTestProviders });

		expect(screen.getByText(/available after you enroll/u)).toBeTruthy();
		expect(screen.queryByRole("status")).toBeNull();
	});
});
