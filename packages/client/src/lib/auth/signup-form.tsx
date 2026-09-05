"use client";

import { SignupSchema } from "@workspace/shared";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/form/password-strength-meter";
import Link from "next/link";
import { useCallback, useMemo, useState, type JSX } from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";
import { passwordStrength } from "./password";

export interface SignupFormProps {
	readonly loginHref?: string;
}

export function SignupForm({ loginHref = "/auth/login" }: SignupFormProps): JSX.Element {
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const { api } = useAuth();
	const mutation = api.auth.signup.useMutation();
	const strength = useMemo(() => passwordStrength(password), [password]);

	const handleFullNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setFullName(event.target.value);
	}, []);

	const handleEmailChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setEmail(event.target.value);
	}, []);

	const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.target.value);
	}, []);

	const handleSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setIsLoading(true);
			setError(null);

			const parsed = SignupSchema.safeParse({ fullName, email, password });
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Invalid signup details");
				setIsLoading(false);
				return;
			}

			mutation
				.mutateAsync(parsed.data)
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
		[email, fullName, mutation, password],
	);

	if (isSubmitted) {
		return (
			<div className="space-y-4 text-center">
				<div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
					Account created. Check your email for a verification link before signing in.
				</div>
				<Link href={loginHref} className="inline-flex text-sm font-medium text-primary hover:underline">
					Back to sign in
				</Link>
			</div>
		);
	}

	return (
		<>
			<FormShell error={error} isLoading={isLoading} submitLabel="Create account" loadingLabel="Creating account..." submitClassName="h-11" onSubmit={handleSubmit}>
				<div className="space-y-2">
					<Label htmlFor="fullName">Full name</Label>
					<Input id="fullName" value={fullName} onChange={handleFullNameChange} required autoComplete="name" className="h-11" />
				</div>
				<div className="space-y-2">
					<Label htmlFor="email">Email</Label>
					<Input id="email" type="email" value={email} onChange={handleEmailChange} required autoComplete="email" className="h-11" />
				</div>
				<div className="space-y-2">
					<Label htmlFor="password">Password</Label>
					<PasswordInput id="password" value={password} onChange={handlePasswordChange} required autoComplete="new-password" className="h-11" />
					<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
				</div>
			</FormShell>
			<p className="mt-6 text-center text-sm text-muted-foreground">
				Already have an account?{" "}
				<Link href={loginHref} className="font-medium text-primary hover:underline">
					Sign in
				</Link>
			</p>
		</>
	);
}
