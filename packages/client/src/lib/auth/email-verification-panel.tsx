"use client";

import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { useCallback, useState, type JSX } from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { useAuth } from "./index";

export function EmailVerificationPanel(): JSX.Element | null {
	const { user, api } = useAuth();
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [isSending, setIsSending] = useState(false);
	const resendMutation = api.auth.resendVerification.useMutation();

	const handleResend = useCallback((): void => {
		if (user === null) return;

		setError(null);
		setMessage(null);
		setIsSending(true);

		resendMutation
			.mutateAsync({ email: user.email })
			.then((response): void => {
				setMessage(response.data.message);
			})
			.catch((err: unknown): void => {
				setError(resolveAuthErrorMessage(err));
			})
			.finally((): void => {
				setIsSending(false);
			});
	}, [resendMutation, user]);

	if (user === null) return null;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="text-sm font-medium text-foreground">Email address</h3>
				{user.isEmailVerified ? (
					<Badge variant="secondary">Verified</Badge>
				) : (
					<Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
						Not verified
					</Badge>
				)}
			</div>
			<p className="text-sm text-muted-foreground">{user.email}</p>
			{user.isEmailVerified ? (
				<p className="text-sm text-muted-foreground">Your email is verified. You can use password reset and other email-dependent features.</p>
			) : (
				<div className="space-y-3">
					<p className="text-sm text-muted-foreground">Verify your email to unlock password reset and other account features. Check your inbox for the verification link.</p>
					{error ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
					{message ? <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">{message}</div> : null}
					<Button type="button" variant="outline" loading={isSending} onClick={handleResend}>
						Resend verification email
					</Button>
				</div>
			)}
		</div>
	);
}
