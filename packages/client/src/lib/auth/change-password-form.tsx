"use client";

import { ChangePasswordSchema } from "@workspace/shared";
import { FormShell } from "@workspace/ui/components/form/form-shell";
import { Label } from "@workspace/ui/components/form/label";
import { PasswordInput } from "@workspace/ui/components/form/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/form/password-strength-meter";
import { useCallback, useMemo, useState, type JSX } from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";
import { passwordStrength } from "./password";

export interface ChangePasswordFormProps {
	readonly onSuccess?: () => void;
}

export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps): JSX.Element {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const { api } = useAuth();
	const mutation = api.auth.changePassword.useMutation();
	const strength = useMemo(() => passwordStrength(newPassword), [newPassword]);

	const handleSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			setIsLoading(true);
			setError(null);
			setSuccess(null);

			const parsed = ChangePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
			if (!parsed.success) {
				setError(parsed.error.issues[0]?.message ?? "Invalid password details");
				setIsLoading(false);
				return;
			}

			mutation
				.mutateAsync(parsed.data)
				.then((response): void => {
					setSuccess(response.data.message);
					setCurrentPassword("");
					setNewPassword("");
					setConfirmPassword("");
					onSuccess?.();
				})
				.catch((err: unknown): void => {
					setError(resolveAuthErrorMessage(err));
				})
				.finally((): void => {
					setIsLoading(false);
				});
		},
		[confirmPassword, currentPassword, mutation, newPassword, onSuccess],
	);

	return (
		<FormShell error={error} isLoading={isLoading} submitLabel="Change password" loadingLabel="Changing..." submitClassName="h-11" onSubmit={handleSubmit}>
			{success ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{success}</div> : null}
			<div className="space-y-2">
				<Label htmlFor="current-password">Current password</Label>
				<PasswordInput id="current-password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required className="h-11" />
			</div>
			<div className="space-y-2">
				<Label htmlFor="new-password">New password</Label>
				<PasswordInput id="new-password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required className="h-11" />
				<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
			</div>
			<div className="space-y-2">
				<Label htmlFor="confirm-password">Confirm new password</Label>
				<PasswordInput id="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="h-11" />
			</div>
		</FormShell>
	);
}
