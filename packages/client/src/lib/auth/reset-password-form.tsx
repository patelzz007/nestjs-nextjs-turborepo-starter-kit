"use client";

import { ResetPasswordSchema } from "@workspace/shared";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { Label } from "@workspace/ui/components/form/label";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/form/password-strength-meter";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";
import { passwordStrength } from "./password";

export interface ResetPasswordFormProps {
	readonly token: string;
	readonly loginHref?: string;
}

export function ResetPasswordForm({ token, loginHref = "/auth/login" }: ResetPasswordFormProps): JSX.Element {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);
	const router = useRouter();
	const { api } = useAuth();
	const mutation = api.auth.resetPassword.useMutation();
	const { mutateAsync: validateResetToken } = api.auth.validateResetToken.useMutation();
	const strength = useMemo(() => passwordStrength(password), [password]);

	useEffect((): (() => void) => {
		if (token.length === 0) {
			setIsTokenValid(false);
			return (): void => {};
		}

		let cancelled = false;
		setIsTokenValid(null);

		void validateResetToken({ token })
			.then((response): void => {
				if (!cancelled) {
					setIsTokenValid(response.data.valid);
				}
			})
			.catch((): void => {
				if (!cancelled) {
					setIsTokenValid(false);
				}
			});

		return (): void => {
			cancelled = true;
		};
	}, [token, validateResetToken]);

	const handlePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.target.value);
	}, []);

	const handleConfirmPasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setConfirmPassword(event.target.value);
	}, []);

	const handleSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setIsLoading(true);
			setError(null);

			const parsed = ResetPasswordSchema.safeParse({ token, password });
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Invalid password");
				setIsLoading(false);
				return;
			}

			if (password !== confirmPassword) {
				setError("Passwords do not match");
				setIsLoading(false);
				return;
			}

			mutation
				.mutateAsync(parsed.data)
				.then((): void => {
					router.push(loginHref);
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				})
				.finally((): void => {
					setIsLoading(false);
				});
		},
		[confirmPassword, loginHref, mutation, password, router, token],
	);

	if (isTokenValid === null) {
		return <p className="text-center text-sm text-muted-foreground">Validating reset link...</p>;
	}

	if (!isTokenValid) {
		return (
			<div className="space-y-4 text-center">
				<p className="text-sm text-destructive">This password reset link is invalid or has expired.</p>
				<Link href="/auth/forgot-password" className="text-sm font-medium text-primary hover:underline">
					Request a new reset link
				</Link>
			</div>
		);
	}

	return (
		<FormShell error={error} isLoading={isLoading} submitLabel="Reset password" loadingLabel="Resetting..." submitClassName="h-11" onSubmit={handleSubmit}>
			<div className="space-y-2">
				<Label htmlFor="new-password">New password</Label>
				<PasswordInput id="new-password" autoComplete="new-password" value={password} onChange={handlePasswordChange} required className="h-11" />
				<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
			</div>
			<div className="space-y-2">
				<Label htmlFor="confirm-password">Confirm password</Label>
				<PasswordInput id="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={handleConfirmPasswordChange} required className="h-11" />
			</div>
			<p className="text-center text-sm text-muted-foreground">
				<Link href={loginHref} className="font-medium text-primary hover:underline">
					Back to sign in
				</Link>
			</p>
		</FormShell>
	);
}
