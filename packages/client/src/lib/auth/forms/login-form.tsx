// ============================================
// packages/client/src/lib/auth/login-form.tsx
// Shared, prop-driven login form for BOTH apps.
//
// The web and admin apps previously shipped near-identical copies (~140 lines
// each) that differed only in the endpoint, an admin-access gate, and a couple
// of defaults. `mode` collapses all of that into one component (point 5 of
// the folder-structure pass — see docs/architecture.md §5).
//
// The heading/subtitle/logo now live on the shared `AuthLayout` (split-screen
// shell); this component is the form itself — email + password fields, the
// submit button, an "Or continue with" divider and the social-login buttons
// (Google / Facebook / Twitter / GitHub — UI-only for now, no provider wiring).
// ============================================
"use client";

import { Button } from "@workspace/ui/components/form/button";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { LockoutCountdown } from "@workspace/ui/components/form/lockout-countdown";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/form/password-strength-meter";
import { Separator } from "@workspace/ui/components/display/separator";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EpochMs, UserResponse } from "@workspace/shared";
import { useCallback, useMemo, useState, type JSX } from "react";

import { isAccountLockedError, resolveAuthErrorMessage } from "../errors";
import { isLoginRestrictedEnrollment, isLoginSuccess, isLoginTwoFactorPending, isLoginVerificationPending } from "./login-response";
import { getEnrollmentRedirectPath, markEnrollmentMessage } from "../edge/restricted-session";
import { useAuth } from "../index";
import { DemoAccountButton, DemoInfoBox, SOCIAL_PROVIDERS, SocialButton } from "./login-form-social";
import type { DemoAccount, LoginFormProps, SocialProvider } from "./login-form-types";

import { passwordStrength } from "../password";

export type { DemoAccount, LoginFormMode, LoginFormProps } from "./login-form-types";

/** Allowed characters for MFA backup codes (matches server charset). */
const BACKUP_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function sanitizeBackupCodeInput(value: string): string {
	const upper = value.toUpperCase();
	let sanitized = "";
	for (const char of upper) {
		if (BACKUP_CODE_CHARSET.includes(char)) {
			sanitized += char;
		}
	}
	return sanitized.slice(0, 16);
}

export function LoginForm({
	emailPlaceholder,
	defaultEmail,
	redirectPath,
	demoAccounts,
	footer,
	mode = "web",
	requireAdminAccess = mode === "admin",
}: LoginFormProps): JSX.Element {
	const [email, setEmail] = useState(defaultEmail ?? "");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Set when the API answers ACCOUNT_LOCKED — drives the live countdown (#27).
	const [lockout, setLockout] = useState<{ readonly remainingSeconds: number; readonly lockedUntil: EpochMs } | null>(null);
	// Social login is UI-only for now — clicking a provider shows an honest hint.
	const [socialHint, setSocialHint] = useState<string | null>(null);
	const [twoFactorTempToken, setTwoFactorTempToken] = useState<string | null>(null);
	const [twoFactorCode, setTwoFactorCode] = useState("");
	const [twoFactorUseBackupCode, setTwoFactorUseBackupCode] = useState(false);
	const [backupCode, setBackupCode] = useState("");
	const [verificationId, setVerificationId] = useState<string | null>(null);
	const [verificationCode, setVerificationCode] = useState("");
	const router = useRouter();
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

	const handleSocialClick = useCallback((provider: SocialProvider): void => {
		setSocialHint(`${provider.label} sign-in is coming soon.`);
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
		(data: { readonly user: UserResponse }): void => {
			if (requireAdminAccess && !data.user.hasAdminAccess) {
				setError("Admin access required. This account does not have administrator privileges.");
				return;
			}

			authLogin({
				id: data.user.id,
				email: data.user.email,
				fullName: data.user.fullName,
				isSuperAdmin: data.user.isSuperAdmin,
				hasAdminAccess: data.user.hasAdminAccess,
				isEmailVerified: data.user.isEmailVerified,
				sessionScope: "full",
				enrollmentReason: null,
				roles: data.user.roles,
			});
			navigateAfterLogin(resolvedRedirect);
		},
		[authLogin, navigateAfterLogin, requireAdminAccess, resolvedRedirect],
	);

	const completeRestrictedEnrollment = useCallback(
		(response: Extract<Parameters<typeof isLoginRestrictedEnrollment>[0], { requiresEnrollment: true }>): void => {
			if (response.user !== undefined) {
				authLogin({
					id: response.user.id,
					email: response.user.email,
					fullName: response.user.fullName,
					isSuperAdmin: response.user.isSuperAdmin,
					hasAdminAccess: response.user.hasAdminAccess,
					isEmailVerified: response.user.isEmailVerified,
					sessionScope: "restricted",
					enrollmentReason: response.enrollmentReason,
					roles: response.user.roles,
				});
			}

			markEnrollmentMessage(response.message);
			navigateAfterLogin(getEnrollmentRedirectPath(mode, response.enrollmentReason, response.organizationSlug));
		},
		[authLogin, mode, navigateAfterLogin],
	);

	const handleLoginResponse = useCallback(
		(response: Parameters<typeof isLoginSuccess>[0]): void => {
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
				completeRestrictedEnrollment(response);
				return;
			}

			if (!isLoginSuccess(response)) {
				setError("Unexpected login response. Please try again.");
				return;
			}

			completeAuthenticatedLogin(response);
		},
		[completeAuthenticatedLogin, completeRestrictedEnrollment],
	);

	const performLogin = useCallback(
		(emailValue: string, passwordValue: string): void => {
			setIsLoading(true);
			setError(null);
			setLockout(null);

			loginMutation
				.mutateAsync({ email: emailValue, password: passwordValue })
				.then((data): void => {
					handleLoginResponse(data.data);
				})
				.catch((err: unknown): void => {
					// Map the API's canonical error code to a friendly message;
					// ACCOUNT_LOCKED carries a structured lockout payload used to
					// render a live countdown (see lockout state below).
					if (isAccountLockedError(err)) {
						setLockout({ remainingSeconds: err.remainingSeconds, lockedUntil: err.lockedUntil });
					}
					setError(resolveAuthErrorMessage(err));
				})
				.finally((): void => {
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
				if (backupCode.length !== 16) {
					setIsLoading(false);
					return;
				}

				backupCodeMutation
					.mutateAsync({ tempToken: twoFactorTempToken, backupCode })
					.then((data): void => {
						handleLoginResponse(data.data);
					})
					.catch((err: unknown): void => {
						setError(resolveAuthErrorMessage(err));
					})
					.finally((): void => {
						setIsLoading(false);
					});
				return;
			}

			if (twoFactorCode.length !== 6) {
				setIsLoading(false);
				return;
			}

			twoFactorMutation
				.mutateAsync({ tempToken: twoFactorTempToken, token: twoFactorCode })
				.then((data): void => {
					handleLoginResponse(data.data);
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				})
				.finally((): void => {
					setIsLoading(false);
				});
		},
		[backupCode, backupCodeMutation, handleLoginResponse, twoFactorCode, twoFactorMutation, twoFactorTempToken, twoFactorUseBackupCode],
	);

	const handleVerificationSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (verificationId === null || verificationCode.length !== 6) {
				return;
			}

			setIsLoading(true);
			setError(null);
			verifyLoginMutation
				.mutateAsync({ verificationId, code: verificationCode })
				.then((data): void => {
					handleLoginResponse(data.data);
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				})
				.finally((): void => {
					setIsLoading(false);
				});
		},
		[handleLoginResponse, verificationCode, verificationId, verifyLoginMutation],
	);

	const handleVerificationCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6));
	}, []);

	const handleTwoFactorCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6));
	}, []);

	const handleBackupCodeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setBackupCode(sanitizeBackupCodeInput(event.target.value));
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
							inputMode="numeric"
							autoComplete="one-time-code"
							placeholder="000000"
							value={verificationCode}
							onChange={handleVerificationCodeChange}
							className="h-11 text-center text-lg tracking-[0.3em]"
							maxLength={6}
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
								Enter one of your <strong>16-character backup codes</strong> (letters A–Z and digits 2–9, excluding ambiguous characters).
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
									autoComplete="one-time-code"
									placeholder="23456789ABCDEFGH"
									value={backupCode}
									onChange={handleBackupCodeChange}
									className="h-11 text-center font-mono text-sm tracking-widest"
									maxLength={16}
								/>
							</>
						) : (
							<>
								<Label htmlFor="two-factor-code" className="sr-only">
									Authenticator code
								</Label>
								<Input
									id="two-factor-code"
									inputMode="numeric"
									autoComplete="one-time-code"
									placeholder="000000"
									value={twoFactorCode}
									onChange={handleTwoFactorCodeChange}
									className="h-11 text-center text-lg tracking-[0.3em]"
									maxLength={6}
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
						<Input
							id="email"
							type="email"
							placeholder={resolvedPlaceholder}
							value={email}
							onChange={handleEmailChange}
							required
							autoComplete="email"
							autoFocus
							className="h-11"
						/>
					</div>
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="password">Password</Label>
							<Link href="/auth/forgot-password" className="text-sm font-medium text-primary hover:underline">
								Forgot password?
							</Link>
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
					{lockout !== null ? (
						<LockoutCountdown
							remainingSeconds={lockout.remainingSeconds}
							labels={{
								lockedPrefix: "Account locked — try again in",
								lockedExpired: "Account locked — you can try again now",
							}}
						/>
					) : null}
				</FormShell>
			)}

			{twoFactorTempToken === null ? (
				<div className="mt-6">
					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<div className="w-full border-t" />
						</div>
						<div className="relative flex justify-center text-sm">
							<span className="bg-background px-2 text-muted-foreground">Or continue with</span>
						</div>
					</div>
				</div>
			) : null}

			{twoFactorTempToken === null ? (
				<>
					<div className="mt-4 grid grid-cols-2 gap-3">
						{SOCIAL_PROVIDERS.map((provider) => (
							<SocialButton key={provider.id} provider={provider} disabled={isLoading} onSelect={handleSocialClick} />
						))}
					</div>
					{socialHint ? <p className="mt-3 text-center text-xs text-muted-foreground">{socialHint}</p> : null}
				</>
			) : null}

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
