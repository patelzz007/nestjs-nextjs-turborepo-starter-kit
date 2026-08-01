// ============================================
// components/login-form.tsx - Admin Login Form
// ============================================
"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { authEndpoints } from "@workspace/client/lib/endpoints";
import { ApiErrorSchema } from "@workspace/client/lib/use-api";
import { FormShell } from "@workspace/ui/components/form-shell";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useRouter } from "next/navigation";
import { useCallback, useState, type JSX, type ReactNode } from "react";

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

export function LoginForm({ logo, title, heading, subtitle, emailPlaceholder = "admin@example.com", redirectPath = "/dashboard", footer }: LoginFormProps): JSX.Element {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const { api, login: authLogin } = useAuth();

	const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
		setEmail(e.target.value);
	}, []);

	const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(e.target.value);
	}, []);

	// Admin login always sends X-Client-Type: admin for cookie isolation
	// (handled by authEndpoints.adminLogin's baseOptions)
	const loginMutation = api.procedure(authEndpoints.adminLogin).useMutation();

	const handleFormSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setIsLoading(true);
			setError(null);

			loginMutation
				.mutateAsync({ email, password })
				.then((data): void => {
					// Verify admin access
					const hasAdminAccess: boolean = data.data.user.hasAdminAccess;
					if (!hasAdminAccess) {
						setError("Admin access required. This account does not have administrator privileges.");
						return;
					}

					authLogin();
					router.push(redirectPath);
				})
				.catch((err: unknown): void => {
					const parsed = ApiErrorSchema.safeParse(err);
					if (parsed.success) {
						setError(parsed.data.message);
					} else if (err instanceof Error) {
						setError(err.message);
					} else {
						setError("Unable to connect to the server. Please try again.");
					}
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
							<Input
								id="password"
								type="password"
								placeholder="Enter your password"
								value={password}
								onChange={handlePasswordChange}
								required
								autoComplete="current-password"
							/>
						</div>
					</FormShell>

					{footer}
				</div>
			</div>
		</>
	);
}
