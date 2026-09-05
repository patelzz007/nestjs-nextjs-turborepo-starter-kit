"use client";

import { ForgotPasswordSchema, type ForgotPasswordInput } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import Link from "next/link";
import { useCallback, useState, type JSX } from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";

export interface ForgotPasswordFormProps {
	readonly loginHref?: string;
}

export function ForgotPasswordForm({ loginHref = "/auth/login" }: ForgotPasswordFormProps): JSX.Element {
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const { api } = useAuth();
	const mutation = api.auth.forgotPassword.useMutation();

	const handleEmailChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setEmail(event.target.value);
	}, []);

	const handleSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setIsLoading(true);
			setError(null);

			const parsed = ForgotPasswordSchema.safeParse({ email });
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Invalid email address");
				setIsLoading(false);
				return;
			}

			const input: ForgotPasswordInput = parsed.data;
			mutation
				.mutateAsync(input)
				.then((): void => {
					setIsSubmitted(true);
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				})
				.finally((): void => {
					setIsLoading(false);
				});
		},
		[email, mutation],
	);

	if (isSubmitted) {
		return (
			<div className="space-y-4 text-center">
				<div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
					If an account exists with this email, we&apos;ve sent a password reset link. The link expires in 1 hour.
				</div>
				<Button variant="outline" className="w-full" render={<Link href={loginHref} />}>
					Back to sign in
				</Button>
			</div>
		);
	}

	return (
		<>
			<FormShell error={error} isLoading={isLoading} submitLabel="Send reset link" loadingLabel="Sending..." submitClassName="h-11" onSubmit={handleSubmit}>
				<div className="space-y-2">
					<Label htmlFor="email">Email</Label>
					<Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={handleEmailChange} required className="h-11" />
				</div>
			</FormShell>
			<p className="mt-6 text-center text-sm text-muted-foreground">
				Remember your password?{" "}
				<Link href={loginHref} className="font-medium text-primary hover:underline">
					Sign in
				</Link>
			</p>
		</>
	);
}
