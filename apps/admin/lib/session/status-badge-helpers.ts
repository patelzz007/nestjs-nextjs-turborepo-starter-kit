import { type Observable, type SchedulerLike, from, fromEvent, of, filter, switchMap, timer } from "rxjs";

import { ApiError } from "@workspace/client/lib/api/use-api";
import type { SessionStatus } from "@workspace/shared";

import type { SessionState } from "./status-badge";

/** Seconds until `expiresAt` (epoch ms) from `now`, floored at 0. */
export function secondsUntil(expiresAt: number, now: Date): number {
	const remaining: number = expiresAt - now.getTime();
	return Math.max(0, Math.round(remaining / 1000));
}

/**
 * True when a silent refresh rotated the token: the new `expiresAt` (epoch ms)
 * is strictly later than the previously observed one. The first sighting
 * (`previous === null`) never counts as a rotation.
 */
export function didTokenRotate(previous: number | null, next: number | null): boolean {
	if (previous === null || next === null) return false;
	return next > previous;
}

/** True when the error means the session is genuinely dead (401 after refresh). */
export function isExpiredSessionError(err: Error): boolean {
	return err instanceof ApiError && err.statusCode === 401;
}

/** Map a failed fetch into a friendly error message (error shaping at the boundary). */
export function toSessionErrorMessage(err: Error): string {
	if (isExpiredSessionError(err)) {
		return "Session expired — please log in again";
	}
	return "Session check failed — network or server error";
}

export async function fetchSessionState(fetchSession: () => Promise<SessionStatus>): Promise<SessionState> {
	try {
		const session = await fetchSession();
		return { status: "ready", session };
	} catch (err) {
		const error: Error = err instanceof Error ? err : new Error(String(err));
		return { status: "error", errorMessage: toSessionErrorMessage(error), retryable: !isExpiredSessionError(error) };
	}
}

export function fetchSessionStateWithRetry(
	fetchSession: () => Promise<SessionStatus>,
	retryMs: number,
	scheduler: SchedulerLike,
	isVisible: () => boolean,
): Observable<SessionState> {
	const attempt = (): Observable<SessionState> =>
		from(fetchSessionState(fetchSession)).pipe(
			switchMap((state) =>
				state.status === "error" && state.retryable
					? timer(retryMs, scheduler).pipe(
							filter(() => isVisible()),
							switchMap(() => attempt()),
						)
					: of(state),
			),
		);

	return attempt();
}

export function sameSessionState(a: SessionState, b: SessionState): boolean {
	if (a.status === "error" && b.status === "error") {
		return a.errorMessage === b.errorMessage && a.retryable === b.retryable;
	}
	if (a.status === "ready" && b.status === "ready") {
		const s = a.session;
		const t = b.session;
		return s.email === t.email && s.fullName === t.fullName && s.expiresAt === t.expiresAt;
	}
	return a.status === b.status;
}

export function isDocumentVisible(): boolean {
	if (typeof document === "undefined") return true;
	return document.visibilityState === "visible";
}

export function defaultVisibilitySource(): Observable<Event> {
	const target: EventTarget = typeof document === "undefined" ? new EventTarget() : document;
	return fromEvent(target, "visibilitychange");
}

export function resolvePollMs(envValue: string | null | undefined): number | null {
	if (envValue === undefined || envValue === null || envValue.trim() === "") return null;

	const parsed = Number(envValue.trim());
	if (!Number.isFinite(parsed) || parsed < 0) return null;

	return parsed === 0 ? null : Math.round(parsed);
}
