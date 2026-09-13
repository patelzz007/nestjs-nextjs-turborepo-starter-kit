import { asyncScheduler, type Observable, type SchedulerLike, merge, startWith, shareReplay, distinctUntilChanged, filter, map, switchMap, timer } from "rxjs";

import type { SessionStatus } from "@workspace/shared";

import type { SessionState } from "./status-badge";
import { defaultVisibilitySource, didTokenRotate, fetchSessionStateWithRetry, isDocumentVisible, resolvePollMs, sameSessionState, secondsUntil } from "./status-badge-helpers";

export interface SessionBadgeStreamParams {
	readonly fetchSession: () => Promise<SessionStatus>;
	readonly isVisible?: () => boolean;
	readonly visibilityChanges?: Observable<Event>;
	readonly pollMs?: number | null;
	readonly retryMs?: number;
	readonly tickMs?: number;
	readonly pulseMs?: number;
	readonly scheduler?: SchedulerLike;
}

export interface SessionBadgeStreams {
	readonly sessionState$: Observable<SessionState>;
	readonly secondsLeft$: Observable<number | null>;
	readonly rotationPulse$: Observable<boolean>;
}

export function buildSessionBadgeStreams(params: SessionBadgeStreamParams): SessionBadgeStreams {
	const {
		fetchSession,
		isVisible = isDocumentVisible,
		visibilityChanges = defaultVisibilitySource(),
		pollMs = resolvePollMs(process.env.NEXT_PUBLIC_SESSION_POLL_MS),
		retryMs = 2_000,
		tickMs = 1_000,
		pulseMs = 2_000,
		scheduler = asyncScheduler,
	} = params;

	const visible$ = visibilityChanges.pipe(
		map(() => isVisible()),
		startWith(isVisible()),
		distinctUntilChanged(),
	);

	const pollArm: Observable<boolean | number>[] = pollMs === null ? [] : [timer(pollMs, pollMs, scheduler).pipe(filter(() => isVisible()))];
	const refetchTriggers$ = merge(...pollArm, visible$.pipe(filter((visible) => visible)));

	const sessionState$ = refetchTriggers$.pipe(
		switchMap(() => fetchSessionStateWithRetry(fetchSession, retryMs, scheduler, isVisible)),
		distinctUntilChanged(sameSessionState),
		shareReplay({ bufferSize: 1, refCount: true }),
	);

	const secondsLeft$ = sessionState$.pipe(
		filter((state): state is SessionState & { readonly status: "ready" } => state.status === "ready"),
		switchMap((state) =>
			timer(0, tickMs, scheduler).pipe(
				filter(() => isVisible()),
				map(() => (state.session.expiresAt === null ? null : secondsUntil(state.session.expiresAt, new Date()))),
			),
		),
	);

	const rotationPulse$ = sessionState$.pipe(
		filter((state): state is SessionState & { readonly status: "ready" } => state.status === "ready"),
		map((state) => state.session.expiresAt),
		distinctUntilChanged((previous, current) => !didTokenRotate(previous, current)),
		filter((_, index) => index > 0),
		switchMap(() =>
			timer(pulseMs, scheduler).pipe(
				map(() => false),
				startWith(true),
			),
		),
	);

	return { sessionState$, secondsLeft$, rotationPulse$ };
}
