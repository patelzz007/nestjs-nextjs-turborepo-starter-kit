"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { authEndpoints } from "@workspace/client/lib/api/endpoints";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { useObservable } from "@workspace/ui/hooks/use-observable";
import { cn } from "@workspace/ui/lib/utils";
import type { SessionStatus } from "@workspace/shared";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import * as React from "react";

import { buildSessionBadgeStreams, type SessionState } from "@/lib/session-status-badge";

/** The loading state shown before the first fetch resolves. Hoisted for a stable identity. */
const INITIAL_STATE: SessionState = { status: "loading" };

/**
 * Session status badge — the "very basic protected API" demo, now stream-driven.
 *
 * The whole thing is a declarative pipeline (`lib/session-badge.ts`):
 *
 * - `sessionState$`  — fetches `GET /session` through the typed procedure's
 *   `fetchOrThrow()`, which runs the SAME 401 → silent-refresh → retry flow
 *   the old `useQuery` used. Fetches happen on mount, on tab-return, and on a
 *   steady poll (`NEXT_PUBLIC_SESSION_POLL_MS`, default 5 minutes; set to `0`
 *   to disable steady polling — the old badge never polled, so the rotation
 *   pulse below was dead code; polling is what makes it observable).
 * - `secondsLeft$`    — the live countdown, re-emitted every second only while
 *   the tab is visible (the old setInterval kept firing in hidden tabs).
 * - `rotationPulse$`  — `true` for 2s whenever `expiresAt` jumps FORWARD: the
 *   unmistakable "silent refresh just rotated the token" glow.
 *
 * The view is the same memoized `SessionStatusView` as before (dumb, pure);
 * the smart wrapper is now just three `useObservable` subscriptions. Every
 * subscription is created and destroyed by `useObservable`'s
 * useSyncExternalStore lifecycle, so unmounting the badge leaves zero active
 * subscriptions (assertable via `@workspace/reactive/testing`).
 */

export interface SessionStatusViewProps {
	readonly status: "loading" | "error" | "ready";
	readonly email?: string;
	readonly fullName?: string;
	/** Seconds remaining until the current access token expires. */
	readonly secondsLeft?: number;
	readonly errorMessage?: string;
	/**
	 * True for a couple of seconds right after a silent refresh rotated the
	 * token — renders a green pulse + "Refreshed just now" instead of the
	 * countdown so the rotation is unmistakable at a glance.
	 */
	readonly refreshed?: boolean;
	/**
	 * Compact rendering for the topbar: hides the name/email identity (the
	 * profile dropdown already shows it) and keeps just the shield + countdown
	 * (or pulse). The countdown drops the "Token expires in" prefix so the pill
	 * stays narrow enough for a 56px topbar. Non-compact keeps the full pill.
	 */
	readonly compact?: boolean;
}

function formatTimeLeft(totalSeconds: number, compact = false): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	// Compact long expiries as `Xh YYm` so a 150-minute token stays a narrow pill.
	if (compact && minutes >= 60) {
		const hours = Math.floor(minutes / 60);
		return `${String(hours)}h ${String(minutes % 60).padStart(2, "0")}m`;
	}
	return `${String(minutes)}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * Dumb, presentational view. Renders one of three compact states:
 * a pulsing "checking" pill, a destructive "session check failed" pill, or a
 * verified pill with the user's name, email and a live token-expiry countdown.
 *
 * When `refreshed` is true the verified pill glows green and shows
 * "Refreshed just now" — the visual proof that a silent refresh happened.
 */
export const SessionStatusView = React.memo(function SessionStatusView({
	status,
	email,
	fullName,
	secondsLeft,
	errorMessage,
	refreshed = false,
	compact = false,
}: SessionStatusViewProps): React.JSX.Element {
	if (status === "loading") {
		return (
			<Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-muted-foreground" aria-label="Session status: checking">
				<Loader2 className="size-3 animate-spin" />
				{compact ? <span>Checking…</span> : <span>Checking session…</span>}
			</Badge>
		);
	}

	if (status === "error") {
		return (
			<Badge variant="destructive" className="gap-1.5 px-2.5 py-1" aria-label="Session status: error">
				<ShieldX className="size-3" />
				{/* Compact still shows the REAL message — the 401 case ("Session
				    expired — please log in again") must stay distinguishable from a
				    transient network error even in a topbar-sized pill. */}
				<span>{errorMessage ?? "Session check failed"}</span>
			</Badge>
		);
	}

	// Guard against an impossible state (ready without a countdown) so the
	// component still renders something sane if the API ever omits exp.
	const formatted = secondsLeft !== undefined ? formatTimeLeft(Math.max(0, secondsLeft), compact) : null;

	return (
		<Badge
			key={refreshed ? "refreshed" : "steady"}
			variant="outline"
			className={cn(
				"gap-1.5 border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-emerald-700 dark:text-emerald-400",
				// `key` remounts the badge when the pulse toggles so the zoom-in
				// animation replays — steady → glow → steady.
				refreshed && "animate-in ring-2 ring-emerald-500/40 duration-300 fill-mode-both zoom-in-95",
			)}
			aria-label="Session status: verified">
			<ShieldCheck className="size-3" />
			{compact ? null : (
				<>
					<span className="font-semibold">{fullName ?? "Verified"}</span>
					<span className="text-muted-foreground">{email}</span>
				</>
			)}
			{refreshed ? (
				<span className="font-semibold text-emerald-600 dark:text-emerald-400">{compact ? "Refreshed" : "· Refreshed just now"}</span>
			) : formatted === null ? (
				<span className="text-muted-foreground/80">{compact ? "—" : "· Token expiry unknown"}</span>
			) : (
				<span className="text-muted-foreground/80 tabular-nums" title={`Token expires in ${formatted}`}>
					{compact ? formatted : `· Token expires in ${formatted}`}
				</span>
			)}
		</Badge>
	);
});

/**
 * Smart wrapper: subscribes to the three badge streams. Fully contained —
 * render `<SessionStatusBadge />` anywhere (the admin topbar is the primary
 * home: the `(panel)` shell stays mounted across navigations, so the badge
 * mounts ONCE and its streams persist for the whole session — no per-page
 * refetch, unlike the old per-page placement).
 *
 * The countdown is computed LOCALLY from the JWT `exp` claim (served as
 * `expiresAt` by `GET /session`) and ticks with a client timer — steady
 * polling is opt-in via `NEXT_PUBLIC_SESSION_POLL_MS` and defaults to OFF.
 */
export interface SessionStatusBadgeProps {
	/** Compact topbar rendering: shield + countdown only (no name/email). */
	readonly compact?: boolean;
}

export function SessionStatusBadge({ compact = false }: SessionStatusBadgeProps): React.JSX.Element {
	const { api } = useAuth();

	// `fetchOrThrow` (not `useQuery`) runs the 401 → silent-refresh → retry
	// pipeline as a plain promise — the stream wraps it. React Query is no
	// longer involved in this component at all. The procedure returns the
	// response envelope, so unwrap `.data` at the boundary.
	const fetchSession = React.useCallback(async (): Promise<SessionStatus> => {
		const response = await api.procedure(authEndpoints.sessionStatus).fetchOrThrow();
		return response.data;
	}, [api]);

	const streams = React.useMemo(() => buildSessionBadgeStreams({ fetchSession }), [fetchSession]);

	const state = useObservable<SessionState>(streams.sessionState$, INITIAL_STATE);
	const secondsLeft = useObservable<number | null>(streams.secondsLeft$, null);
	const refreshed = useObservable<boolean>(streams.rotationPulse$, false);

	if (state.status === "loading") {
		return <SessionStatusView status="loading" compact={compact} />;
	}

	if (state.status === "error") {
		return <SessionStatusView status="error" errorMessage={state.errorMessage} compact={compact} />;
	}

	return (
		<div className="animate-in duration-200 fill-mode-both fade-in slide-in-from-top-1">
			<SessionStatusView
				status="ready"
				email={state.session.email}
				fullName={state.session.fullName}
				secondsLeft={secondsLeft ?? undefined}
				refreshed={refreshed}
				compact={compact}
			/>
		</div>
	);
}
