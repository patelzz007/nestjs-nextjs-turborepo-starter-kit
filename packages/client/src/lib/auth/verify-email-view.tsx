"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/ui/components/form/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type JSX } from "react";

import { resolveAuthErrorMessage } from "./auth-errors";
import { markEmailVerifiedToast } from "./email-verified-toast";
import { useAuth } from "./index";
import { toAuthUser } from "./map-auth-user";

const AUTH_ME_QUERY_KEY: readonly ["auth", "me"] = ["auth", "me"];

export interface VerifyEmailViewProps {
	readonly token: string;
	readonly settingsHref: string;
	readonly loginHref?: string;
}

export function VerifyEmailView({ token, settingsHref, loginHref = "/auth/login" }: VerifyEmailViewProps): JSX.Element {
	const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
	const [message, setMessage] = useState("Verifying your email...");
	const router = useRouter();
	const queryClient = useQueryClient();
	const { api, login, isAuthenticated, user } = useAuth();
	const { mutateAsync: verifyEmail } = api.auth.verifyEmail.useMutation();
	const completedRef = useRef(false);

	useEffect(() => {
		if (token.length === 0 || completedRef.current) {
			return;
		}

		const abortController = new AbortController();
		const isCancelled = (): boolean => abortController.signal.aborted;

		const redirectToSettings = (): void => {
			if (isCancelled() || completedRef.current) {
				return;
			}
			completedRef.current = true;
			setStatus("redirecting");
			setMessage("Email verified! Taking you to settings…");
			markEmailVerifiedToast();
			router.replace(settingsHref);
			window.setTimeout((): void => {
				if (window.location.pathname.startsWith("/auth/verify-email")) {
					window.location.assign(settingsHref);
				}
			}, 1200);
		};

		const syncVerifiedSession = async (): Promise<void> => {
			if (!isAuthenticated) {
				return;
			}

			if (user !== null) {
				login({ ...user, isEmailVerified: true });
			}

			await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });

			try {
				const meResponse = await api.auth.me.fetchOrThrow(undefined);
				if (isCancelled()) {
					return;
				}
				login(toAuthUser(meResponse.data));
				queryClient.setQueryData(AUTH_ME_QUERY_KEY, meResponse);
			} catch {
				// Optimistic update remains if the profile refetch fails.
			}
		};

		void (async (): Promise<void> => {
			try {
				await verifyEmail({ token });
				if (isCancelled()) {
					return;
				}
				await syncVerifiedSession();
				if (isCancelled()) {
					return;
				}
				redirectToSettings();
			} catch (err: unknown) {
				if (isCancelled()) {
					return;
				}
				setStatus("error");
				setMessage(resolveAuthErrorMessage(err));
			}
		})();

		return (): void => {
			abortController.abort();
		};
	}, [api.auth.me, isAuthenticated, login, queryClient, router, settingsHref, token, user, verifyEmail]);

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
