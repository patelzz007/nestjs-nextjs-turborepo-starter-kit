// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import {
	APP_LINKS,
	BACKUP_CODE_LENGTH,
	epochMs,
	normalizeBackupCodeInput,
	type ApiResponseMeta,
	type Envelope,
	type LoginClientResponse,
	type LoginInput,
	type LoginTwoFactorInput,
	type UserResponse,
	type VerifyBackupCodeLoginInput,
	type VerifyLoginInput,
} from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture, userFixture } from "../../../test/auth-fixtures";
import { ApiError } from "../../api/use-api";
import { LoginForm } from "./login-form";

type LoginAnswer = Promise<Envelope<LoginClientResponse>>;

const mocks = vi.hoisted(() => ({
	login: vi.fn<(input: LoginInput) => LoginAnswer>(),
	adminLogin: vi.fn<(input: LoginInput) => LoginAnswer>(),
	merchantLogin: vi.fn<(input: LoginInput) => LoginAnswer>(),
	loginTwoFactor: vi.fn<(input: LoginTwoFactorInput) => LoginAnswer>(),
	loginBackupCode: vi.fn<(input: VerifyBackupCodeLoginInput) => LoginAnswer>(),
	verifyLogin: vi.fn<(input: VerifyLoginInput) => LoginAnswer>(),
	authLogin: vi.fn<(user: UserResponse, meta: ApiResponseMeta) => void>(),
	push: vi.fn<(href: string) => void>(),
	replace: vi.fn<(href: string) => void>(),
	refresh: vi.fn<() => void>(),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: (href: string) => void; readonly replace: (href: string) => void; readonly refresh: () => void } => ({
		push: mocks.push,
		replace: mocks.replace,
		refresh: mocks.refresh,
	}),
}));

vi.mock("../index", () => {
	const api = {
		auth: {
			login: { useMutation: (): { readonly mutateAsync: typeof mocks.login; readonly isPending: boolean } => ({ mutateAsync: mocks.login, isPending: false }) },
			adminLogin: {
				useMutation: (): { readonly mutateAsync: typeof mocks.adminLogin; readonly isPending: boolean } => ({ mutateAsync: mocks.adminLogin, isPending: false }),
			},
			merchantLogin: {
				useMutation: (): { readonly mutateAsync: typeof mocks.merchantLogin; readonly isPending: boolean } => ({ mutateAsync: mocks.merchantLogin, isPending: false }),
			},
			loginTwoFactor: {
				useMutation: (): { readonly mutateAsync: typeof mocks.loginTwoFactor; readonly isPending: boolean } => ({ mutateAsync: mocks.loginTwoFactor, isPending: false }),
			},
			loginBackupCode: {
				useMutation: (): { readonly mutateAsync: typeof mocks.loginBackupCode; readonly isPending: boolean } => ({ mutateAsync: mocks.loginBackupCode, isPending: false }),
			},
			verifyLogin: {
				useMutation: (): { readonly mutateAsync: typeof mocks.verifyLogin; readonly isPending: boolean } => ({ mutateAsync: mocks.verifyLogin, isPending: false }),
			},
		},
	};
	return {
		useAuth: (): { readonly login: typeof mocks.authLogin; readonly api: typeof api } => ({ login: mocks.authLogin, api }),
	};
});

const EMAIL = "member@example.com";
const PASSWORD = "Secret@123";
const TEMP_TOKEN = "temp-token-1";
const VERIFICATION_ID = "verification-1";
/** A meta distinct from the shared fixture, so the test proves the RESPONSE's meta is forwarded. */
const LOGIN_META: ApiResponseMeta = { correlationId: "corr-login", timestamp: epochMs(1_786_428_123_000) };

function successAnswer(user: UserResponse = userFixture()): Envelope<LoginClientResponse> {
	return envelopeFixture<LoginClientResponse>({ user }, LOGIN_META);
}

function twoFactorPendingAnswer(): Envelope<LoginClientResponse> {
	return envelopeFixture<LoginClientResponse>({ requiresTwoFactor: true, tempToken: TEMP_TOKEN, message: "Two-factor code required" }, LOGIN_META);
}

function fillCredentials(): void {
	fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } });
	fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } });
}

function submitCredentials(): void {
	fillCredentials();
	fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

async function reachTwoFactorStep(): Promise<void> {
	mocks.login.mockResolvedValue(twoFactorPendingAnswer());
	render(<LoginForm />, { wrapper: UiKitTestProviders });
	submitCredentials();
	await screen.findByLabelText("Authenticator code");
}

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	cleanup();
	window.sessionStorage.clear();
});

describe("LoginForm forgot-password link", () => {
	it("links to the shared forgot-password page by default", () => {
		render(<LoginForm />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe(APP_LINKS.auth.forgotPassword);
	});

	it("uses the given destination", () => {
		render(<LoginForm forgotPasswordHref="/help/password" />, { wrapper: UiKitTestProviders });

		expect(screen.getByRole("link", { name: "Forgot password?" }).getAttribute("href")).toBe("/help/password");
	});

	it("is hidden for an app without a password-reset flow (null)", () => {
		render(<LoginForm forgotPasswordHref={null} />, { wrapper: UiKitTestProviders });

		expect(screen.queryByRole("link", { name: "Forgot password?" })).toBeNull();
		expect(screen.getByLabelText("Password")).toBeDefined();
	});
});

describe("LoginForm social login", () => {
	it("offers no social-login buttons (there is no provider integration)", () => {
		render(<LoginForm />, { wrapper: UiKitTestProviders });

		expect(screen.queryByRole("button", { name: /google/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /github/i })).toBeNull();
		expect(screen.queryByText(/or continue with/i)).toBeNull();
	});
});

describe("LoginForm password sign-in", () => {
	it("submits the typed email and password to the login mutation", async () => {
		mocks.login.mockResolvedValue(successAnswer());
		render(<LoginForm />, { wrapper: UiKitTestProviders });

		submitCredentials();

		await waitFor((): void => {
			expect(mocks.login).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
		});
		expect(mocks.adminLogin).not.toHaveBeenCalled();
	});

	it("signs the user in with the response envelope's meta and navigates to the redirect", async () => {
		const user = userFixture({ id: "user-42" });
		mocks.login.mockResolvedValue(successAnswer(user));
		render(<LoginForm redirectPath="/dashboard" />, { wrapper: UiKitTestProviders });

		submitCredentials();

		await waitFor((): void => {
			expect(mocks.push).toHaveBeenCalledWith("/dashboard");
		});
		expect(mocks.authLogin).toHaveBeenCalledTimes(1);
		expect(mocks.authLogin).toHaveBeenCalledWith(user, LOGIN_META);
	});

	it("navigates to /hello by default for the web app", async () => {
		mocks.login.mockResolvedValue(successAnswer());
		render(<LoginForm />, { wrapper: UiKitTestProviders });

		submitCredentials();

		await waitFor((): void => {
			expect(mocks.push).toHaveBeenCalledWith("/hello");
		});
	});

	it("shows the friendly message for an INVALID_CREDENTIALS API error and stays signed out", async () => {
		mocks.login.mockRejectedValue(new ApiError({ message: "Invalid credentials", error: "INVALID_CREDENTIALS", statusCode: 401 }));
		render(<LoginForm />, { wrapper: UiKitTestProviders });

		submitCredentials();

		expect(await screen.findByText("Incorrect email or password. Please try again.")).toBeDefined();
		expect(mocks.authLogin).not.toHaveBeenCalled();
		expect(mocks.push).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
	});
});

describe("LoginForm admin mode", () => {
	it("uses the admin login endpoint and rejects an account without admin access", async () => {
		mocks.adminLogin.mockResolvedValue(successAnswer(userFixture({ hasAdminAccess: false })));
		render(<LoginForm mode="admin" />, { wrapper: UiKitTestProviders });

		submitCredentials();

		expect(await screen.findByText("Admin access required. This account does not have administrator privileges.")).toBeDefined();
		expect(mocks.adminLogin).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
		expect(mocks.login).not.toHaveBeenCalled();
		expect(mocks.authLogin).not.toHaveBeenCalled();
		expect(mocks.push).not.toHaveBeenCalled();
	});

	it("signs in an account with admin access and navigates to the admin root", async () => {
		const admin = userFixture({ hasAdminAccess: true });
		mocks.adminLogin.mockResolvedValue(successAnswer(admin));
		render(<LoginForm mode="admin" />, { wrapper: UiKitTestProviders });

		submitCredentials();

		await waitFor((): void => {
			expect(mocks.push).toHaveBeenCalledWith("/");
		});
		expect(mocks.authLogin).toHaveBeenCalledWith(admin, LOGIN_META);
	});
});

describe("LoginForm two-factor step", () => {
	it("switches to the authenticator-code step when the login answer requires 2FA", async () => {
		await reachTwoFactorStep();

		expect(screen.queryByLabelText("Password")).toBeNull();
		expect(screen.getByRole("button", { name: "Verify code" })).toBeDefined();
		expect(mocks.authLogin).not.toHaveBeenCalled();
		expect(mocks.push).not.toHaveBeenCalled();
	});

	it("keeps only digits in the authenticator code, at most six", async () => {
		await reachTwoFactorStep();
		const codeInput = screen.getByLabelText<HTMLInputElement>("Authenticator code");

		fireEvent.change(codeInput, { target: { value: "12a-34 5678" } });

		expect(codeInput.value).toBe("123456");
	});

	it("does not submit an incomplete authenticator code", async () => {
		await reachTwoFactorStep();

		fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "12345" } });
		fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

		await waitFor((): void => {
			expect(screen.getByRole("button", { name: "Verify code" })).toBeDefined();
		});
		expect(mocks.loginTwoFactor).not.toHaveBeenCalled();
	});

	it("submits a six-digit code with the temp token and completes the sign-in", async () => {
		const user = userFixture({ twoFactorEnabled: true });
		await reachTwoFactorStep();
		mocks.loginTwoFactor.mockResolvedValue(successAnswer(user));

		fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
		fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

		await waitFor((): void => {
			expect(mocks.push).toHaveBeenCalledWith("/hello");
		});
		expect(mocks.loginTwoFactor).toHaveBeenCalledWith({ tempToken: TEMP_TOKEN, token: "123456" });
		expect(mocks.authLogin).toHaveBeenCalledWith(user, LOGIN_META);
	});

	it("shows the API error of a rejected authenticator code", async () => {
		await reachTwoFactorStep();
		mocks.loginTwoFactor.mockRejectedValue(new ApiError({ message: "Invalid two-factor code", statusCode: 401 }));

		fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "000000" } });
		fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

		expect(await screen.findByText("Invalid two-factor code")).toBeDefined();
		expect(mocks.authLogin).not.toHaveBeenCalled();
	});
});

describe("LoginForm backup-code path", () => {
	async function reachBackupCodeStep(): Promise<HTMLInputElement> {
		await reachTwoFactorStep();
		fireEvent.click(screen.getByRole("button", { name: "Use a backup code instead" }));
		return screen.getByLabelText<HTMLInputElement>("Backup code");
	}

	it("normalizes typed input: upper-cases, drops separators and ambiguous characters, stops at 16", async () => {
		const backupInput = await reachBackupCodeStep();
		const typed = "abcd-efgh 0O1IL 2345_6789-jkmn-pqrs";

		fireEvent.change(backupInput, { target: { value: typed } });

		expect(backupInput.value).toBe("ABCDEFGH23456789");
		expect(backupInput.value).toBe(normalizeBackupCodeInput(typed));
		expect(backupInput.value).toHaveLength(BACKUP_CODE_LENGTH);
	});

	it("does not submit a backup code shorter than 16 characters", async () => {
		const backupInput = await reachBackupCodeStep();

		fireEvent.change(backupInput, { target: { value: "ABCD-EFGH" } });
		fireEvent.click(screen.getByRole("button", { name: "Verify backup code" }));

		await waitFor((): void => {
			expect(screen.getByRole("button", { name: "Verify backup code" })).toBeDefined();
		});
		expect(mocks.loginBackupCode).not.toHaveBeenCalled();
		expect(mocks.loginTwoFactor).not.toHaveBeenCalled();
	});

	it("submits the full normalized backup code with the temp token", async () => {
		const user = userFixture({ twoFactorEnabled: true });
		const backupInput = await reachBackupCodeStep();
		mocks.loginBackupCode.mockResolvedValue(successAnswer(user));

		fireEvent.change(backupInput, { target: { value: "abcd-efgh-2345-6789" } });
		fireEvent.click(screen.getByRole("button", { name: "Verify backup code" }));

		await waitFor((): void => {
			expect(mocks.push).toHaveBeenCalledWith("/hello");
		});
		expect(mocks.loginBackupCode).toHaveBeenCalledWith({ tempToken: TEMP_TOKEN, backupCode: "ABCDEFGH23456789" });
		expect(mocks.loginTwoFactor).not.toHaveBeenCalled();
		expect(mocks.authLogin).toHaveBeenCalledWith(user, LOGIN_META);
	});

	it("can switch back to the authenticator code", async () => {
		await reachBackupCodeStep();

		fireEvent.click(screen.getByRole("button", { name: "Use authenticator code instead" }));

		expect(screen.getByLabelText("Authenticator code")).toBeDefined();
		expect(screen.queryByLabelText("Backup code")).toBeNull();
	});
});

describe("LoginForm email-verification step", () => {
	it("shows the emailed-code step and submits the code with the verification id", async () => {
		const user = userFixture();
		mocks.login.mockResolvedValue(
			envelopeFixture<LoginClientResponse>({ requiresVerification: true, verificationId: VERIFICATION_ID, message: "Check your email" }, LOGIN_META),
		);
		mocks.verifyLogin.mockResolvedValue(successAnswer(user));
		render(<LoginForm />, { wrapper: UiKitTestProviders });

		submitCredentials();
		const codeInput = await screen.findByLabelText<HTMLInputElement>("Verification code");
		expect(mocks.authLogin).not.toHaveBeenCalled();

		fireEvent.change(codeInput, { target: { value: "65-43 21" } });
		expect(codeInput.value).toBe("654321");
		fireEvent.click(screen.getByRole("button", { name: "Verify sign-in" }));

		await waitFor((): void => {
			expect(mocks.push).toHaveBeenCalledWith("/hello");
		});
		expect(mocks.verifyLogin).toHaveBeenCalledWith({ verificationId: VERIFICATION_ID, code: "654321" });
		expect(mocks.authLogin).toHaveBeenCalledWith(user, LOGIN_META);
	});

	it("does not submit an incomplete emailed code", async () => {
		mocks.login.mockResolvedValue(
			envelopeFixture<LoginClientResponse>({ requiresVerification: true, verificationId: VERIFICATION_ID, message: "Check your email" }, LOGIN_META),
		);
		render(<LoginForm />, { wrapper: UiKitTestProviders });

		submitCredentials();
		fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123" } });
		fireEvent.click(screen.getByRole("button", { name: "Verify sign-in" }));

		await waitFor((): void => {
			expect(screen.getByRole("button", { name: "Verify sign-in" })).toBeDefined();
		});
		expect(mocks.verifyLogin).not.toHaveBeenCalled();
	});
});

describe("LoginForm restricted enrollment", () => {
	it("signs the restricted session in and sends a web user to the account page", async () => {
		const user = userFixture({ isEmailVerified: false });
		mocks.login.mockResolvedValue(
			envelopeFixture<LoginClientResponse>({ requiresEnrollment: true, enrollmentReason: "email_verification", message: "Verify your email to continue", user }, LOGIN_META),
		);
		render(<LoginForm />, { wrapper: UiKitTestProviders });

		submitCredentials();

		await waitFor((): void => {
			expect(mocks.push).toHaveBeenCalledWith("/rewardhub/account");
		});
		expect(mocks.authLogin).toHaveBeenCalledWith(user, LOGIN_META);
		expect(window.sessionStorage.getItem("auth:enrollment-message")).toBe("Verify your email to continue");
	});

	it("routes a merchant to the organization's account page and refreshes the router", async () => {
		const user = userFixture();
		mocks.merchantLogin.mockResolvedValue(
			envelopeFixture<LoginClientResponse>(
				{ requiresEnrollment: true, enrollmentReason: "mfa_enrollment", message: "Set up two-factor authentication", user, organizationSlug: "acme-store" },
				LOGIN_META,
			),
		);
		render(<LoginForm mode="merchant" />, { wrapper: UiKitTestProviders });

		submitCredentials();

		await waitFor((): void => {
			expect(mocks.push).toHaveBeenCalledWith("/orgs/acme-store/account");
		});
		expect(mocks.refresh).toHaveBeenCalledTimes(1);
		expect(mocks.merchantLogin).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
		expect(mocks.login).not.toHaveBeenCalled();
		expect(mocks.authLogin).toHaveBeenCalledWith(user, LOGIN_META);
	});
});
