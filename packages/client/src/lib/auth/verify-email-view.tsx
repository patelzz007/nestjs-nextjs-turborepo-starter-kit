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

	const loginRef = useRef(login);
	loginRef.current = login;
	const userRef = useRef(user);
	userRef.current = user;
	const isAuthenticatedRef = useRef(isAuthenticated);
	isAuthenticatedRef.current = isAuthenticated;
	const verifyEmailRef = useRef(verifyEmail);
	verifyEmailRef.current = verifyEmail;
	const fetchMeRef = useRef(api.auth.me.fetchOrThrow);
	fetchMeRef.current = api.auth.me.fetchOrThrow;
	const queryClientRef = useRef(queryClient);
	queryClientRef.current = queryClient;
	const routerRef = useRef(router);
	routerRef.current = router;
	const settingsHrefRef = useRef(settingsHref);
	settingsHrefRef.current = settingsHref;

	useEffect((): (() => void) => {
		if (token.length === 0 || completedRef.current) {
			return (): void => {};
		}

		let cancelled = false;

		const redirectToSettings = (): void => {
			if (cancelled || completedRef.current) {
				return;
			}
			completedRef.current = true;
			setStatus("redirecting");
			setMessage("Email verified! Taking you to settings…");
			markEmailVerifiedToast();
			const target = settingsHrefRef.current;
			routerRef.current.replace(target);
			window.setTimeout((): void => {
				if (window.location.pathname.startsWith("/auth/verify-email")) {
					window.location.assign(target);
				}
			}, 1200);
		};

		const syncVerifiedSession = async (): Promise<void> => {
			if (!isAuthenticatedRef.current) {
				return;
			}

			const currentUser = userRef.current;
			if (currentUser !== null) {
				loginRef.current({ ...currentUser, isEmailVerified: true });
			}

			await queryClientRef.current.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });

			try {
				const meResponse = await fetchMeRef.current(undefined);
				if (cancelled) {
					return;
				}
				loginRef.current(toAuthUser(meResponse.data));
				queryClientRef.current.setQueryData(AUTH_ME_QUERY_KEY, meResponse);
			} catch {
				// Optimistic update remains if the profile refetch fails.
			}
		};

		void (async (): Promise<void> => {
			try {
				await verifyEmailRef.current({ token });
				if (cancelled) {
					return;
				}
				await syncVerifiedSession();
				if (cancelled) {
					return;
				}
				redirectToSettings();
			} catch (err: unknown) {
				if (cancelled) {
					return;
				}
				setStatus("error");
				setMessage(resolveAuthErrorMessage(err));
			}
		})();

		return (): void => {
			cancelled = true;
		};
	}, [token]);

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
