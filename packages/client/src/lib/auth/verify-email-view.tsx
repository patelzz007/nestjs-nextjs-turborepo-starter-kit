"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/form/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type JSX } from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { markEmailVerifiedToast } from "./email-verified-toast";
import { useAuth } from "./index";
import { syncSessionAfterEmailVerification } from "./sync-session-after-email-verification";

export interface VerifyEmailViewProps {
	readonly token: string;
	readonly settingsHref: string;
	readonly loginHref?: string;
	/** Where to send the user after a successful verify + session refresh. @default settingsHref */
	readonly successRedirectHref?: string;
}

export function VerifyEmailView({ token, settingsHref, loginHref = "/auth/login", successRedirectHref }: VerifyEmailViewProps): JSX.Element {
	const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
	const [message, setMessage] = useState("Verifying your email...");
	const router = useRouter();
	const queryClient = useQueryClient();
	const { api, login } = useAuth();
	const completedRef = useRef(false);
	const cancelledRef = useRef(false);
	const redirectTarget = successRedirectHref ?? settingsHref;

	useEffect((): (() => void) => {
		if (token.length === 0 || completedRef.current) {
			return (): void => undefined;
		}

		cancelledRef.current = false;

		const isCancelled = (): boolean => cancelledRef.current;

		const redirectAfterVerification = (verifyMessage: string): void => {
			if (isCancelled() || completedRef.current) {
				return;
			}
			completedRef.current = true;
			setStatus("redirecting");
			const alreadyVerified = verifyMessage.toLowerCase().includes("already verified");
			setMessage(alreadyVerified ? "Email already verified. Opening your account…" : "Email verified! Opening your account…");
			markEmailVerifiedToast();
			router.replace(redirectTarget);
			router.refresh();
			window.setTimeout((): void => {
				if (window.location.pathname.startsWith("/auth/verify-email")) {
					window.location.assign(redirectTarget);
				}
			}, 1200);
		};

		void (async (): Promise<void> => {
			try {
				const verifyResponse = await api.auth.verifyEmail.mutate({ token });
				if (isCancelled()) {
					return;
				}

				await syncSessionAfterEmailVerification(api, login, queryClient);
				if (isCancelled()) {
					return;
				}

				redirectAfterVerification(verifyResponse.data.message);
			} catch (err: unknown) {
				if (isCancelled()) {
					return;
				}
				setStatus("error");
				setMessage(resolveAuthErrorMessage(err));
			}
		})();

		return (): void => {
			cancelledRef.current = true;
		};
	}, [api, api.auth.verifyEmail, login, queryClient, redirectTarget, router, token]);

	return (
		<div className="space-y-4 text-center">
			{status === "loading" || status === "redirecting" ? <p className="text-sm text-muted-foreground">{message}</p> : null}
			{status === "error" ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{message}</div> : null}
			{status === "error" ? (
				<Button variant="outline" className="w-full" render={<Link href={loginHref} />}>
					Back to sign in
				</Button>
			) : null}
		</div>
	);
}
