// ============================================
// packages/client/src/lib/login-form.tsx
// Shared, prop-driven login form for BOTH apps.
//
// The web and admin apps previously shipped near-identical copies (~140 lines
// each) that differed only in the endpoint, an admin-access gate, and a couple
// of defaults. `mode` collapses all of that into one component (point 5 of
// the folder-structure pass — see docs/architecture.md §5).
// ============================================
"use client";

import { FormShell } from "@workspace/ui/components/form/form-shell";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { LockoutCountdown } from "@workspace/ui/components/form/lockout-countdown";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/form/password-strength-meter";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type JSX, type ReactNode } from "react";

import { isAccountLockedError, resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";
import { authEndpoints } from "../api/endpoints";
import { passwordStrength } from "./password";

/** Which app the form is authenticating for — drives endpoint + defaults. */
export type LoginFormMode = "web" | "admin";

export interface LoginFormProps {
	readonly logo: ReactNode;
	readonly title: string;
	readonly heading: string;
	readonly subtitle: string;
	/** @default mode === "admin" ? "admin@example.com" : "m@example.com" */
	readonly emailPlaceholder?: string;
	/** @default mode === "admin" ? "/" : "/hello" */
	readonly redirectPath?: string;
	readonly footer?: ReactNode;
	/**
	 * Selects the login endpoint (`authEndpoints.login` vs `.adminLogin` — the
	 * latter sends `X-Client-Type: admin` for cookie isolation) plus the
	 * per-app defaults above. @default "web"
	 */
	readonly mode?: LoginFormMode;
	/**
	 * Rejects accounts without `hasAdminAccess` after a successful login
	 * (the admin panel's privilege gate). @default mode === "admin"
	 */
	readonly requireAdminAccess?: boolean;
}

export function LoginForm({
	logo,
	title,
	heading,
	subtitle,
	emailPlaceholder,
	redirectPath,
	footer,
	mode = "web",
	requireAdminAccess = mode === "admin",
}: LoginFormProps): JSX.Element {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Set when the API answers ACCOUNT_LOCKED — drives the live countdown (#27).
	const [lockout, setLockout] = useState<{ readonly remainingSeconds: number; readonly lockedUntil: string } | null>(null);
	const router = useRouter();
	const { api, login: authLogin } = useAuth();

	const resolvedPlaceholder: string = emailPlaceholder ?? (mode === "admin" ? "admin@example.com" : "m@example.com");
	const resolvedRedirect: string = redirectPath ?? (mode === "admin" ? "/" : "/hello");

	const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
		setEmail(e.target.value);
	}, []);

	const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(e.target.value);
	}, []);

	// Admin logins send `X-Client-Type: admin` (handled by the endpoint's
	// baseOptions) so the backend sets the isolated admin cookie set.
	const loginMutation = api.procedure(mode === "admin" ? authEndpoints.adminLogin : authEndpoints.login).useMutation();

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
				.then((data): void => {
					// Privilege gate (admin mode only): the API already rejects
					// non-privileged accounts, but this keeps the client honest.
					if (requireAdminAccess && !data.data.user.hasAdminAccess) {
						setError("Admin access required. This account does not have administrator privileges.");
						return;
					}

					authLogin();
					router.push(resolvedRedirect);
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
		[email, password, loginMutation, authLogin, router, resolvedRedirect, requireAdminAccess],
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
							<Input id="email" type="email" placeholder={resolvedPlaceholder} value={email} onChange={handleEmailChange} required autoComplete="email" autoFocus />
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="password">Password</Label>
								<Link href="/auth/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline">
									Forgot password?
								</Link>
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
