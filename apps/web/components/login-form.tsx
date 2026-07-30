// ============================================
// components/login-form.tsx - Web Login Form
// ============================================
"use client";

import { useState, type FormEvent, type JSX, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { FormShell } from "@workspace/ui/components/form-shell";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useAuth } from "@workspace/ui/lib/auth";

// ── Zod schema for the login response envelope ─────────────────────────────

const ApiErrorBodySchema = z
	.object({
		message: z.string(),
	})
	.loose();

// ── Response shape ─────────────────────────────────────────────────────────

interface LoginApiResponse {
	readonly data?: Record<string, unknown>;
}

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
	const router = useRouter();
	const { api, login: authLogin } = useAuth();

	const loginMutation = api.useMutation<LoginApiResponse, { email: string; password: string }>("POST", "/auth/login");

	async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setIsLoading(true);
		setError(null);

		try {
			await loginMutation.mutateAsync({ email, password });

			authLogin();
			router.push(redirectPath);
		} catch (err: unknown) {
			const parsed = ApiErrorBodySchema.safeParse(err);
			if (parsed.success) {
				setError(parsed.data.message);
			} else if (err instanceof Error) {
				setError(err.message);
			} else {
				setError("Unable to connect to the server. Please try again.");
			}
		} finally {
			setIsLoading(false);
		}
	}

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

					<FormShell error={error} isLoading={isLoading} submitLabel="Login" loadingLabel="Logging in..." onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input id="email" type="email" placeholder={emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
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
								onChange={(e) => setPassword(e.target.value)}
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
