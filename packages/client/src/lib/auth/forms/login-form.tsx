// ============================================
// packages/client/src/lib/auth/login-form.tsx
// Shared, prop-driven login form for BOTH apps.
//
// The web and admin apps previously shipped near-identical copies (~140 lines
// each) that differed only in the endpoint, an admin-access gate, and a couple
// of defaults. `mode` collapses all of that into one component (the shared auth
// forms live in `@workspace/client` — see docs/technical/architecture.md §1).
//
// The heading/subtitle/logo now live on the shared `AuthLayout` (split-screen
// shell); this component is the form itself — email + password fields, the
// submit button, the second-factor / email-verification steps and the
// optional demo accounts. (No social-login buttons: there is no provider
// integration, and a button that cannot sign anyone in is not shipped.)
// ============================================
"use client";

import {
	APP_LINKS,
	BACKUP_CODE_LENGTH,
	normalizeBackupCodeInput,
	TOTP_CODE_LENGTH,
	type ApiResponseMeta,
	type LoginClientResponse,
	type LoginRestrictedEnrollmentClientResponse,
	type UserResponse,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { FormShell } from "@workspace/ui/components/form-shell";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/password-strength-meter";
import { Separator } from "@workspace/ui/components/separator";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";

import { resolveAuthErrorMessage } from "../errors";
import { isLoginRestrictedEnrollment, isLoginSuccess, isLoginTwoFactorPending, isLoginVerificationPending } from "./login-response";
import { getEnrollmentRedirectPath } from "../edge/restricted-session";
import { markEnrollmentMessage } from "../session/enrollment-message";
import { useAuth } from "../index";
import { DemoAccountButton, DemoInfoBox } from "./login-form-demo";
import type { DemoAccount, LoginFormProps } from "./login-form-types";

import { passwordStrength } from "../password";
import { catchCaught } from "../../caught";

export type { DemoAccount, LoginFormMode, LoginFormProps } from "./login-form-types";

/** The digits typed into a one-time-code field, at most one code long. */
function sanitizeNumericCode(value: string): string {
	return value.replace(/\D/g, "").slice(0, TOTP_CODE_LENGTH);
}

/** A login step's answer: the response body plus the envelope `meta` it came with. */
interface LoginStepAnswer {
	readonly data: LoginClientResponse;
	readonly meta: ApiResponseMeta;
}

export function LoginForm({
	emailPlaceholder,
	defaultEmail,
	redirectPath,
	demoAccounts,
	footer,
	mode = "web",
	requireAdminAccess = mode === "admin",
	forgotPasswordHref = APP_LINKS.auth.forgotPassword,
}: LoginFormProps): JSX.Element {
	const [email, setEmail] = useState(defaultEmail ?? "");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [twoFactorTempToken, setTwoFactorTempToken] = useState<string | null>(null);
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const [twoFactorUseBackupCode, setTwoFactorUseBackupCode] = useState(false);
	const [backupCode, setBackupCode] = useState("");
	const [verificationId, setVerificationId] = useState<string | null>(null);
	const [verificationCode, setVerificationCode] = useState("");
	const router = useRouter();
	// The one-time-code field of the current step. When the form switches to a
	// code step (email verification, authenticator, backup code) focus moves to
	// it, so keyboard and screen-reader users land where the new step starts.
	// The first step does not grab focus on page load.
	const codeInputRef = useRef<HTMLInputElement>(null);
	const isCodeStep: boolean = verificationId !== null || twoFactorTempToken !== null;
	useEffect((): void => {
		if (isCodeStep) {
			codeInputRef.current?.focus();
		}
	}, [isCodeStep, twoFactorUseBackupCode]);
	const { api, login: authLogin } = useAuth();

	const resolvedPlaceholder: string = emailPlaceholder ?? (mode === "admin" ? "admin@example.com" : "m@example.com");
	const resolvedRedirect: string = redirectPath ?? (mode === "admin" ? "/" : "/hello");

	const navigateAfterLogin = useCallback(
		(targetPath: string): void => {
			if (mode === "merchant") {
				router.push(targetPath);
				router.refresh();
				return;
			}
			router.push(targetPath);
		},
		[mode, router],
	);

	const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
		setEmail(e.target.value);
	}, []);

	const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(e.target.value);
	}, []);

	// Admin logins send `X-Client-Type: admin` (handled by the def's baseOptions) so the backend sets the isolated admin cookie set.
	const loginProcedure = mode === "admin" ? api.auth.adminLogin : mode === "merchant" ? api.auth.merchantLogin : api.auth.login;
	const loginMutation = loginProcedure.useMutation();
	const twoFactorMutation = api.auth.loginTwoFactor.useMutation();
	const backupCodeMutation = api.auth.loginBackupCode.useMutation();
	const verifyLoginMutation = api.auth.verifyLogin.useMutation();

	// Live password-strength feedback while typing (#27).
	const strength = useMemo(() => passwordStrength(password), [password]);

	// The actual login call — shared by the form submit and the demo buttons.
	const completeAuthenticatedLogin = useCallback(
		(data: { readonly user: UserResponse }, meta: ApiResponseMeta): void => {
			if (requireAdminAccess && !data.user.hasAdminAccess) {
				setError("Admin access required. This account does not have administrator privileges.");
				return;
			}

			authLogin(data.user, meta);
			navigateAfterLogin(resolvedRedirect);
		},
		[authLogin, navigateAfterLogin, requireAdminAccess, resolvedRedirect],
	);

	const completeRestrictedEnrollment = useCallback(
		(response: LoginRestrictedEnrollmentClientResponse, meta: ApiResponseMeta): void => {
			if (response.user !== undefined) {
				authLogin(response.user, meta);
			}

			markEnrollmentMessage(response.message);
			navigateAfterLogin(getEnrollmentRedirectPath(mode, response.enrollmentReason, response.organizationSlug));
		},
		[authLogin, mode, navigateAfterLogin],
	);

	const handleLoginResponse = useCallback(
		({ data: response, meta }: LoginStepAnswer): void => {
			if (isLoginTwoFactorPending(response)) {
				setTwoFactorTempToken(response.tempToken);
				setTwoFactorUseBackupCode(false);
				setBackupCode("");
				setVerificationId(null);
				setError(null);
				return;
			}

			if (isLoginVerificationPending(response)) {
				setVerificationId(response.verificationId);
				setTwoFactorTempToken(null);
				setError(null);
				return;
			}

			if (isLoginRestrictedEnrollment(response)) {
				completeRestrictedEnrollment(response, meta);
				return;
			}

			if (!isLoginSuccess(response)) {
				setError("Unexpected login response. Please try again.");
				return;
			}

			completeAuthenticatedLogin(response, meta);
		},
		[completeAuthenticatedLogin, completeRestrictedEnrollment],
	);

	const performLogin = useCallback(
		(emailValue: string, passwordValue: string): void => {
			setIsLoading(true);
			setError(null);

			void catchCaught(
				loginMutation.mutateAsync({ email: emailValue, password: passwordValue }).then((answer): void => {
					handleLoginResponse(answer);
				}),
				(err): void => {
					// The API's canonical error code → a friendly message. A locked
					// account answers INVALID_CREDENTIALS by design (no account probing).
					setError(resolveAuthErrorMessage(err));
				},
			).finally((): void => {
				setIsLoading(false);
			});
		},
		[loginMutation, handleLoginResponse],
	);

	const handleTwoFactorSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (twoFactorTempToken === null) {
				return;
			}

			setIsLoading(true);
			setError(null);

			if (twoFactorUseBackupCode) {
				if (backupCode.length !== BACKUP_CODE_LENGTH) {
					setIsLoading(false);
					return;
				}

				void catchCaught(
					backupCodeMutation.mutateAsync({ tempToken: twoFactorTempToken, backupCode }).then((answer): void => {
						handleLoginResponse(answer);
					}),
					(err): void => {
						setError(resolveAuthErrorMessage(err));
					},
				).finally((): void => {
					setIsLoading(false);
				});
				return;
			}

			if (twoFactorCode.length !== TOTP_CODE_LENGTH) {
				setIsLoading(false);
				return;
			}

			void catchCaught(
				twoFactorMutation.mutateAsync({ tempToken: twoFactorTempToken, token: twoFactorCode }).then((answer): void => {
					handleLoginResponse(answer);
				}),
				(err): void => {
					setError(resolveAuthErrorMessage(err));
				},
			).finally((): void => {
				setIsLoading(false);
			});
		},
		[backupCode, backupCodeMutation, handleLoginResponse, twoFactorCode, twoFactorMutation, twoFactorTempToken, twoFactorUseBackupCode],
	);

	const handleVerificationSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (verificationId === null || verificationCode.length !== TOTP_CODE_LENGTH) {
				return;
			}

			setIsLoading(true);
			setError(null);
			void catchCaught(
				verifyLoginMutation.mutateAsync({ verificationId, code: verificationCode }).then((answer): void => {
					handleLoginResponse(answer);
				}),
				(err): void => {
					setError(resolveAuthErrorMessage(err));
				},
			).finally((): void => {
				setIsLoading(false);
			});
		},
		[handleLoginResponse, verificationCode, verificationId, verifyLoginMutation],
	);

	const handleVerificationCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setVerificationCode(sanitizeNumericCode(event.target.value));
	}, []);

	const handleTwoFactorCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setTwoFactorCode(sanitizeNumericCode(event.target.value));
	}, []);

	const handleBackupCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setBackupCode(normalizeBackupCodeInput(event.target.value));
	}, []);

	const handleUseAuthenticatorCode = useCallback((): void => {
		setTwoFactorUseBackupCode(false);
		setBackupCode("");
		setError(null);
	}, []);

	const handleUseBackupCode = useCallback((): void => {
		setTwoFactorUseBackupCode(true);
		setTwoFactorCode("");
		setError(null);
	}, []);

	const handleFormSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			performLogin(email, password);
		},
		[email, password, performLogin],
	);

	const handleDemoSelect = useCallback(
		(account: DemoAccount): void => {
			// Fill the fields so the user sees what's being submitted, then log in.
			setEmail(account.email);
			setPassword(account.password);
			performLogin(account.email, account.password);
		},
		[performLogin],
	);

	return (
		<>
			{verificationId !== null ? (
				<FormShell error={error} isLoading={isLoading} submitLabel="Verify sign-in" loadingLabel="Verifying..." submitClassName="h-11" onSubmit={handleVerificationSubmit}>
					<div className="space-y-2 text-center">
						<p className="text-sm text-muted-foreground">
							Enter the <strong>6-digit code from your email</strong> — not your authenticator app. Check spam or Promotions if you do not see it.
						</p>
						<p className="text-xs text-muted-foreground">Use the code from your most recent sign-in attempt. Requesting a new code invalidates older ones.</p>
						<Label htmlFor="verification-code" className="sr-only">
							Verification code
						</Label>
						<Input
							id="verification-code"
							ref={codeInputRef}
							inputMode="numeric"
							autoComplete="one-time-code"
							placeholder="000000"
							value={verificationCode}
							onChange={handleVerificationCodeChange}
							className="h-11 text-center text-lg tracking-[0.3em]"
							maxLength={TOTP_CODE_LENGTH}
						/>
					</div>
				</FormShell>
			) : twoFactorTempToken !== null ? (
				<FormShell
					error={error}
					isLoading={isLoading}
					submitLabel={twoFactorUseBackupCode ? "Verify backup code" : "Verify code"}
					loadingLabel="Verifying..."
					submitClassName="h-11"
					onSubmit={handleTwoFactorSubmit}>
					<div className="space-y-2 text-center">
						{twoFactorUseBackupCode ? (
							<p className="text-sm text-muted-foreground">
								Enter one of your <strong>{BACKUP_CODE_LENGTH}-character backup codes</strong> (letters A–Z and digits 2–9, excluding ambiguous characters).
							</p>
						) : (
							<p className="text-sm text-muted-foreground">
								Enter the <strong>6-digit code from your authenticator app</strong> (Google Authenticator, 1Password, etc.).
							</p>
						)}
						{twoFactorUseBackupCode ? (
							<>
								<Label htmlFor="backup-code" className="sr-only">
									Backup code
								</Label>
								<Input
									id="backup-code"
									ref={codeInputRef}
									autoComplete="one-time-code"
									placeholder="23456789ABCDEFGH"
									value={backupCode}
									onChange={handleBackupCodeChange}
									className="h-11 text-center font-mono text-sm tracking-widest"
									maxLength={BACKUP_CODE_LENGTH}
								/>
							</>
						) : (
							<>
								<Label htmlFor="two-factor-code" className="sr-only">
									Authenticator code
								</Label>
								<Input
									id="two-factor-code"
									ref={codeInputRef}
									inputMode="numeric"
									autoComplete="one-time-code"
									placeholder="000000"
									value={twoFactorCode}
									onChange={handleTwoFactorCodeChange}
									className="h-11 text-center text-lg tracking-[0.3em]"
									maxLength={TOTP_CODE_LENGTH}
								/>
							</>
						)}
						<Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={twoFactorUseBackupCode ? handleUseAuthenticatorCode : handleUseBackupCode}>
							{twoFactorUseBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
						</Button>
					</div>
				</FormShell>
			) : (
				<FormShell error={error} isLoading={isLoading} submitLabel="Sign in" loadingLabel="Signing in..." submitClassName="h-11" onSubmit={handleFormSubmit}>
					<div className="space-y-2">
						<Label htmlFor="email">Email</Label>
						<Input id="email" type="email" placeholder={resolvedPlaceholder} value={email} onChange={handleEmailChange} required autoComplete="email" className="h-11" />
					</div>
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="password">Password</Label>
							{forgotPasswordHref === null ? null : (
								<Link href={forgotPasswordHref} className="text-sm font-medium text-primary hover:underline">
									Forgot password?
								</Link>
							)}
						</div>
						<PasswordInput
							id="password"
							placeholder="Enter your password"
							value={password}
							onChange={handlePasswordChange}
							required
							autoComplete="current-password"
							className="h-11"
						/>
						<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
					</div>
				</FormShell>
			)}

			{twoFactorTempToken === null && demoAccounts !== undefined && demoAccounts.length > 0 ? (
				<div className="mt-4">
					<Separator />
					<div className="mt-4 text-center">
						<p className="mb-3 text-sm text-muted-foreground">Try demo accounts:</p>
						<div className="space-y-2">
							{demoAccounts.map((account) => (
								<DemoAccountButton key={account.email} account={account} disabled={isLoading} onSelect={handleDemoSelect} />
							))}
						</div>

						<DemoInfoBox accounts={demoAccounts} />
					</div>
				</div>
			) : null}

			{twoFactorTempToken === null && footer ? <div className="mt-6">{footer}</div> : null}
		</>
	);
}
