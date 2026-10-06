"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { APP_LINKS } from "@workspace/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type JSX } from "react";

import type { ApiRouter } from "../../api/endpoints";
import type { ApiClient } from "../../api/use-api";
import { catchCaught } from "../../caught";
import { resolveAuthErrorMessage } from "../errors";
import { markEmailVerifiedToast } from "./verified-toast";
import { useAuth, useAuthCommands } from "../index";
import {
	syncSessionAfterEmailVerification,
	type EmailVerificationSessionApi,
	type EmailVerificationSessionCommands,
	type EmailVerificationSyncResult,
} from "./sync-after-verification";

export interface VerifyEmailViewProps {
	readonly token: string;
	readonly settingsHref: string;
	readonly loginHref?: string;
	/** Where to send the user after a successful verify + session refresh. @default settingsHref */
	readonly successRedirectHref?: string;
}

/** What one verification run concluded. */
export type VerifyEmailOutcome =
	{ readonly kind: "verified"; readonly alreadyVerified: boolean; readonly session: EmailVerificationSyncResult } | { readonly kind: "failed"; readonly message: string };

type ViewState =
	| { readonly status: "verifying" }
	| { readonly status: "redirecting"; readonly message: string }
	| { readonly status: "session-unavailable"; readonly message: string }
	| { readonly status: "error"; readonly message: string };

/** The calls one verification makes (`useAuth().api` satisfies it). */
export interface VerifyEmailApi extends EmailVerificationSessionApi {
	readonly auth: EmailVerificationSessionApi["auth"] & {
		readonly verifyEmail: Pick<ApiClient<ApiRouter>["auth"]["verifyEmail"], "mutate">;
	};
}

/**
 * Verifies the token ONCE, then syncs the session. The API's typed
 * `alreadyVerified` flag decides the copy — never the message text.
 */
export function verifyEmailOnce(api: VerifyEmailApi, session: EmailVerificationSessionCommands, token: string): Promise<VerifyEmailOutcome> {
	return catchCaught(
		api.auth.verifyEmail.mutate({ token }).then(async (response): Promise<VerifyEmailOutcome> => ({
			kind: "verified",
			alreadyVerified: response.data.alreadyVerified,
			session: await syncSessionAfterEmailVerification(api, session),
		})),
		(error): VerifyEmailOutcome => ({ kind: "failed", message: resolveAuthErrorMessage(error) }),
	);
}

const SESSION_UNAVAILABLE_MESSAGE = "Your email is verified, but we could not refresh your session right now.";

export function VerifyEmailView({ token, settingsHref, loginHref = APP_LINKS.auth.login, successRedirectHref }: VerifyEmailViewProps): JSX.Element {
	const [state, setState] = useState<ViewState>({ status: "verifying" });
	const router = useRouter();
	const { api } = useAuth();
	const sessionCommands = useAuthCommands();
	const redirectTarget = successRedirectHref ?? settingsHref;

	// One verification per token, shared by every effect run of this mount:
	// React may run the effect twice (Strict Mode, remounts), and a verification
	// link must not be spent twice. Each run applies the shared outcome only
	// while it is current (its own `active` flag), so cancellation is per run.
	const verificationRef = useRef<{ readonly token: string; readonly outcome: Promise<VerifyEmailOutcome> } | null>(null);
	// The token whose outcome was applied — an outcome navigates, so it is applied once.
	const appliedTokenRef = useRef<string | null>(null);

	const applyOutcome = useCallback(
		(outcome: VerifyEmailOutcome): void => {
			if (outcome.kind === "failed") {
				setState({ status: "error", message: outcome.message });
				return;
			}
			const verifiedCopy = outcome.alreadyVerified ? "Email already verified." : "Email verified!";
			switch (outcome.session) {
				case "synced":
					markEmailVerifiedToast();
					setState({ status: "redirecting", message: `${verifiedCopy} Opening your account…` });
					router.replace(redirectTarget);
					router.refresh();
					return;
				case "no-session":
					setState({ status: "redirecting", message: `${verifiedCopy} Sign in to continue…` });
					router.replace(loginHref);
					return;
				case "unavailable":
					setState({ status: "session-unavailable", message: `${verifiedCopy} ${SESSION_UNAVAILABLE_MESSAGE}` });
					return;
			}
		},
		[loginHref, redirectTarget, router],
	);

	useEffect((): (() => void) => {
		if (token.length === 0) {
			return (): void => undefined;
		}
		if (verificationRef.current?.token !== token) {
			verificationRef.current = { token, outcome: verifyEmailOnce(api, sessionCommands, token) };
		}
		let active = true;
		void verificationRef.current.outcome.then((outcome: VerifyEmailOutcome): void => {
			if (active && appliedTokenRef.current !== token) {
				appliedTokenRef.current = token;
				applyOutcome(outcome);
			}
		});
		return (): void => {
			active = false;
		};
	}, [api, applyOutcome, sessionCommands, token]);

	const handleRetrySession = useCallback((): void => {
		setState({ status: "verifying" });
		void syncSessionAfterEmailVerification(api, sessionCommands).then((session: EmailVerificationSyncResult): void => {
			applyOutcome({ kind: "verified", alreadyVerified: true, session });
		});
	}, [api, applyOutcome, sessionCommands]);

	return (
		<div className="space-y-4 text-center">
			{state.status === "verifying" ? <p className="text-sm text-muted-foreground">Verifying your email...</p> : null}
			{state.status === "redirecting" ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
			{state.status === "session-unavailable" ? (
				<>
					<p className="text-sm text-muted-foreground">{state.message}</p>
					<Button type="button" className="w-full" onClick={handleRetrySession}>
						Try again
					</Button>
				</>
			) : null}
			{state.status === "error" ? <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{state.message}</div> : null}
			{state.status === "error" ? (
				<Link href={loginHref} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
					Back to sign in
				</Link>
			) : null}
		</div>
	);
}
