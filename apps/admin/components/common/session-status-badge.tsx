"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { authEndpoints } from "@workspace/client/lib/endpoints";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import * as React from "react";

/**
 * Session status badge — the "very basic protected API" demo.
 *
 * On mount it calls `GET /session` (which requires a valid access token). That
 * single call makes the silent-refresh flow observable on **SPA navigation**:
 *
 * - `DashboardShell` fetches `/auth/me` once when the panel mounts and stays
 *   mounted across navigations — so it never fires again when you click around.
 * - This badge lives in each page, so every time you navigate to one of the
 *   demo pages (`/`, `/settings/general`, `/settings/billing`) it fires a
 *   fresh `GET /session`. If the access token expired, the API answers 401 →
 *   the client silently refreshes (`POST /auth/refresh`) → the request retries.
 *   The live countdown below then shows a fresh `expiresAt` — proof the token
 *   was rotated without any user interaction or full page reload.
 *
 * The view is split into a smart wrapper (query + countdown) and a dumb,
 * memoized presentational `SessionStatusView` so the rendering is unit-testable
 * without mocking React Query (same split as `BreadcrumbTrail`).
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
}

function formatTimeLeft(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
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
}: SessionStatusViewProps): React.JSX.Element {
	if (status === "loading") {
		return (
			<Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-muted-foreground" aria-label="Session status: checking">
				<Loader2 className="size-3 animate-spin" />
				<span>Checking session…</span>
			</Badge>
		);
	}

	if (status === "error") {
		return (
			<Badge variant="destructive" className="gap-1.5 px-2.5 py-1" aria-label="Session status: error">
				<ShieldX className="size-3" />
				<span>{errorMessage ?? "Session check failed"}</span>
			</Badge>
		);
	}

	// Guard against an impossible state (ready without a countdown) so the
	// component still renders something sane if the API ever omits exp.
	const label = secondsLeft !== undefined ? `Token expires in ${formatTimeLeft(Math.max(0, secondsLeft))}` : "Token expiry unknown";

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
			<span className="font-semibold">{fullName ?? "Verified"}</span>
			<span className="text-muted-foreground">{email}</span>
			{refreshed ? (
				<span className="font-semibold text-emerald-600 dark:text-emerald-400">· Refreshed just now</span>
			) : (
				<span className="text-muted-foreground/80 tabular-nums" title="Refresh the page or navigate again to watch the silent refresh rotate this">
					· {label}
				</span>
			)}
		</Badge>
	);
});

function secondsUntil(expiresAt: string, now: Date): number {
	const remaining = new Date(expiresAt).getTime() - now.getTime();
	return Math.max(0, Math.round(remaining / 1000));
}

/**
 * True when a silent refresh rotated the token: the new `expiresAt` is strictly
 * later than the previously observed one. Compared as epoch milliseconds rather
 * than ISO strings because `DateStringSchema` permits offset-bearing timestamps
 * (`+08:00` etc.), which don't sort lexicographically against UTC `Z` strings.
 * The first sighting (`previous === null`) never counts as a rotation.
 */
export function didTokenRotate(previous: string | null, next: string | null): boolean {
	if (previous === null || next === null) return false;
	return new Date(next).getTime() > new Date(previous).getTime();
}

/**
 * Smart wrapper: owns the `GET /session` query + a 1s countdown tick.
 * Fully contained — pages just render `<SessionStatusBadge />`.
 */
export function SessionStatusBadge(): React.JSX.Element {
	const { api } = useAuth();
	// `staleTime: 0` is deliberate: the badge exists to fire a fresh `GET /session`
	// on EVERY page mount, so a navigated-to page with an expired token triggers
	// the 401 → silent-refresh → retry flow. A larger staleTime would serve the
	// cached session on navigation and silently defeat this demo.
	const sessionQuery = api.procedure(authEndpoints.sessionStatus).useQuery(undefined, { staleTime: 0 });

	// One tick per second re-renders the countdown without refetching. The timer
	// pauses while the tab is hidden (browsers throttle intervals there anyway,
	// and no one is looking at the badge) and cleans up on unmount.
	const [now, setNow] = React.useState<Date>(() => new Date());
	React.useEffect(() => {
		const tick = (): void => {
			setNow(new Date());
		};
		const timer = window.setInterval(tick, 1000);
		const onVisibilityChange = (): void => {
			if (document.visibilityState === "visible") {
				tick(); // resync immediately when the tab becomes visible again
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		return (): void => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, []);

	const session = sessionQuery.data?.data;

	// ── Refresh pulse ────────────────────────────────────────────────────────
	// A silent refresh is visible as `expiresAt` jumping FORWARD (the rotated
	// token lives longer than the one we last saw). When that happens, glow the
	// badge green for ~2s so the rotation is unmistakable. The first sighting
	// (mount) and same-value refetches don't count — only an actual rotation.
	const [refreshed, setRefreshed] = React.useState(false);
	const prevExpiresAtRef = React.useRef<string | null>(null);
	const pulseTimeoutRef = React.useRef<number | null>(null);

	React.useEffect(() => {
		const expiresAt: string | null = session?.expiresAt ?? null;
		const previous: string | null = prevExpiresAtRef.current;
		prevExpiresAtRef.current = expiresAt;

		if (didTokenRotate(previous, expiresAt)) {
			setRefreshed(true);
			if (pulseTimeoutRef.current !== null) {
				window.clearTimeout(pulseTimeoutRef.current);
			}
			pulseTimeoutRef.current = window.setTimeout((): void => {
				setRefreshed(false);
				pulseTimeoutRef.current = null;
			}, 2000);
		}
	}, [session?.expiresAt]);

	// Clear any pending pulse timer on unmount (e.g. SPA navigation away).
	React.useEffect(() => {
		return (): void => {
			if (pulseTimeoutRef.current !== null) {
				window.clearTimeout(pulseTimeoutRef.current);
			}
		};
	}, []);

	if (sessionQuery.isLoading) {
		return <SessionStatusView status="loading" />;
	}

	if (sessionQuery.error !== null || session === undefined) {
		return <SessionStatusView status="error" errorMessage="Session check failed — please log in again" />;
	}

	return (
		<div className="animate-in duration-200 fill-mode-both fade-in slide-in-from-top-1">
			<SessionStatusView
				status="ready"
				email={session.email}
				fullName={session.fullName}
				secondsLeft={session.expiresAt !== null ? secondsUntil(session.expiresAt, now) : undefined}
				refreshed={refreshed}
			/>
		</div>
	);
}
