// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ApiResponseMeta, Envelope, UserResponse, VerifyEmailResponse } from "@workspace/shared";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture, userFixture } from "../../../test/auth-fixtures";
import type { RefreshResult } from "../../api/api-request";
import { ApiError } from "../../api/use-api";
import { VerifyEmailView } from "./verify-email-view";

const mocks = vi.hoisted(() => ({
	verifyEmail: vi.fn<(input: { readonly token: string }) => Promise<Envelope<VerifyEmailResponse>>>(),
	fetchMe: vi.fn<() => Promise<Envelope<UserResponse>>>(),
	refreshSession: vi.fn<() => Promise<RefreshResult>>(),
	login: vi.fn<(profile: UserResponse, answeredBy: ApiResponseMeta) => void>(),
	replace: vi.fn<(url: string) => void>(),
	refresh: vi.fn<() => void>(),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly replace: (url: string) => void; readonly refresh: () => void } => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("../index", () => {
	const api = { auth: { verifyEmail: { mutate: mocks.verifyEmail }, me: { fetchOrThrow: mocks.fetchMe } } };
	const commands = { login: mocks.login, refreshSession: mocks.refreshSession };
	return {
		useAuth: (): { readonly api: typeof api } => ({ api }),
		useAuthCommands: (): typeof commands => commands,
	};
});

const TOKEN = "verify-token";
const SETTINGS = "/account";

function renderView(): void {
	render(
		<StrictMode>
			<VerifyEmailView token={TOKEN} settingsHref={SETTINGS} loginHref="/auth/login" />
		</StrictMode>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.fetchMe.mockResolvedValue(envelopeFixture(userFixture({ isEmailVerified: true })));
	mocks.refreshSession.mockResolvedValue("ok");
});

afterEach(() => {
	cleanup();
	window.sessionStorage.clear();
});

describe("VerifyEmailView", () => {
	it("spends the token ONCE and rotates the session once, even when React runs the effect twice (Strict Mode)", async () => {
		mocks.verifyEmail.mockResolvedValue(envelopeFixture({ message: "Email verified successfully", alreadyVerified: false }));

		renderView();

		await waitFor((): void => {
			expect(mocks.replace).toHaveBeenCalledWith(SETTINGS);
		});
		expect(mocks.verifyEmail).toHaveBeenCalledTimes(1);
		expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
		expect(mocks.login).toHaveBeenCalledTimes(1);
		expect(mocks.refresh).toHaveBeenCalledTimes(1);
		expect(screen.getByText("Email verified! Opening your account…")).toBeDefined();
	});

	it("branches on the typed alreadyVerified flag, not on the message text", async () => {
		mocks.verifyEmail.mockResolvedValue(envelopeFixture({ message: "Done", alreadyVerified: true }));

		renderView();

		expect(await screen.findByText("Email already verified. Opening your account…")).toBeDefined();
	});

	it("sends a guest (no session to update) to sign in", async () => {
		mocks.verifyEmail.mockResolvedValue(envelopeFixture({ message: "Email verified successfully", alreadyVerified: false }));
		mocks.refreshSession.mockResolvedValue("expired");

		renderView();

		await waitFor((): void => {
			expect(mocks.replace).toHaveBeenCalledWith("/auth/login");
		});
		expect(mocks.login).not.toHaveBeenCalled();
	});

	it("offers a retry — never a hard navigation — when the session could not be refreshed", async () => {
		mocks.verifyEmail.mockResolvedValue(envelopeFixture({ message: "Email verified successfully", alreadyVerified: false }));
		mocks.refreshSession.mockResolvedValueOnce("transient").mockResolvedValueOnce("ok");

		renderView();

		const retry = await screen.findByRole("button", { name: "Try again" });
		expect(mocks.replace).not.toHaveBeenCalled();

		retry.click();
		await waitFor((): void => {
			expect(mocks.replace).toHaveBeenCalledWith(SETTINGS);
		});
		expect(mocks.verifyEmail).toHaveBeenCalledTimes(1);
	});

	it("shows the friendly message of a failed verification", async () => {
		mocks.verifyEmail.mockRejectedValue(new ApiError({ message: "Invalid or expired verification token", statusCode: 401 }));

		renderView();

		expect(await screen.findByText("Invalid or expired verification token")).toBeDefined();
		expect(mocks.refreshSession).not.toHaveBeenCalled();
	});
});
