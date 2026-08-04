// ============================================
// components/login-form.tsx - Web Login Form
// ============================================
"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { isAccountLockedError, resolveAuthErrorMessage } from "@workspace/client/lib/auth-errors";
import { authEndpoints } from "@workspace/client/lib/endpoints";
import { passwordStrength } from "@workspace/client/lib/password";
import { FormShell } from "@workspace/ui/components/form-shell";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { LockoutCountdown } from "@workspace/ui/components/lockout-countdown";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/password-strength-meter";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type JSX, type ReactNode } from "react";

// ── Props ───────────────────────────────────────────────────────────────────

export interface LoginFormProps {
	readonly logo: ReactNode;
	readonly title: string;
	readonly heading: string;
	readonly subtitle: string;
	readonly emailPlaceholder?: string;
	readonly redirectPath?: string;
	readonly footer?: ReactNode;
}

// ── Component ───────────────────────────────────────────────────────────────

export function LoginForm({ logo, title, heading, subtitle, emailPlaceholder = "m@example.com", redirectPath = "/hello", footer }: LoginFormProps): JSX.Element {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Set when the API answers ACCOUNT_LOCKED — drives the live countdown (#27).
	const [lockout, setLockout] = useState<{ readonly remainingSeconds: number; readonly lockedUntil: string } | null>(null);
	const router = useRouter();
	const { api, login: authLogin } = useAuth();

	const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
		setEmail(e.target.value);
	}, []);

	const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(e.target.value);
	}, []);

	const loginMutation = api.procedure(authEndpoints.login).useMutation();

	// Live password-strength feedback while typing (#27).
	const strength = useMemo(() => passwordStrength(password), [password]);
	const handleFormSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setIsLoading(true);
			setError(null);
			setLockout(null);

			loginMutation
				.mutateAsync({ email, password })
				.then((): void => {
					authLogin();
					router.push(redirectPath);
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
		[email, password, loginMutation, authLogin, router, redirectPath],
	);

	return (
		<>
			<div className="flex items-center gap-2 text-lg font-semibold">
				{logo}
				{title}
			</div>

			<div className="flex flex-1 items-center justify-center">
				<div className="w-full max-w-sm space-y-6">
					<div className="space-y-2 text-center lg:text-left">
						<h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
						<p className="text-sm text-balance text-muted-foreground">{subtitle}</p>
					</div>

					<FormShell error={error} isLoading={isLoading} submitLabel="Login" loadingLabel="Logging in..." onSubmit={handleFormSubmit}>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input id="email" type="email" placeholder={emailPlaceholder} value={email} onChange={handleEmailChange} required autoComplete="email" autoFocus />
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="password">Password</Label>
								<a href="/auth/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
									Forgot password?
								</a>
							</div>
							<PasswordInput id="password" placeholder="Enter your password" value={password} onChange={handlePasswordChange} required autoComplete="current-password" />
							<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} missing={strength.missing} />
						</div>
						{lockout !== null ? <LockoutCountdown remainingSeconds={lockout.remainingSeconds} /> : null}
					</FormShell>

					{footer}
				</div>
			</div>
		</>
	);
}
