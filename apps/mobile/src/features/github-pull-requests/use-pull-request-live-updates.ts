// ============================================
// use-pull-request-live-updates.ts - A pull request that updates by itself (ADR 052)
// ============================================
// Whether the pull request's repository has live updates, turning them on and
// off (the API registers or deletes a GitHub webhook with the linked token),
// and — while they are on, this screen is showing and the app is in the
// foreground — the repository's change stream: a change to this pull request
// (or a `resync`, when the server may have missed some) reloads every view of
// it. The stream carries no content; the views are read again as usual.

import { useQueryClient } from "@tanstack/react-query";
import { buildUrl } from "@workspace/api-client";
import { apiRoutes, GithubPullRequestChangeSchema, isChangeTo, type GithubLiveUpdatesStatus, type GithubPullRequestParams } from "@workspace/shared";
import { fetch as expoFetch } from "expo/fetch";
import { useFocusEffect } from "expo-router";
import * as React from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useApi } from "../../lib/api-context";
import { errorMessageOf } from "../../lib/error-messages";
import { openServerEventStream, type ServerEvent, type ServerEventStreamState, type StreamingFetch } from "../../lib/server-events";
import { useReadyRuntime } from "../../runtime/runtime-context";
import { useToast } from "../toast/facade";
import { refreshLiveUpdates, refreshPullRequest } from "./refresh";

/** Where live updates of the repository stand, as the screen shows them. */
export interface PullRequestLiveUpdates {
	/** `unavailable`: the server has no live updates, or their state could not be read — nothing is shown. */
	readonly status: GithubLiveUpdatesStatus["status"] | "unavailable" | "loading";
	/** The stream, while live updates are on and the screen is showing. */
	readonly connection: ServerEventStreamState | "idle";
	readonly isChanging: boolean;
	readonly turnOn: () => void;
	readonly turnOff: () => void;
}

/** `expo/fetch`, which streams a response body (React Native's own fetch cannot). */
const streamingFetch: StreamingFetch = (url, init) => expoFetch(url, { headers: init.headers, signal: init.signal });

/** In the foreground — anything but backgrounded or inactive (the OS may report `unknown` before its first change). */
function isForeground(state: AppStateStatus | null): boolean {
	return state !== "background" && state !== "inactive";
}

function useAppIsActive(): boolean {
	const [active, setActive] = React.useState(isForeground(AppState.currentState));
	React.useEffect((): (() => void) => {
		const subscription = AppState.addEventListener("change", (state: AppStateStatus): void => {
			setActive(isForeground(state));
		});
		return (): void => {
			subscription.remove();
		};
	}, []);
	return active;
}

function useScreenIsFocused(): boolean {
	const [focused, setFocused] = React.useState(false);
	useFocusEffect(
		React.useCallback((): (() => void) => {
			setFocused(true);
			return (): void => {
				setFocused(false);
			};
		}, []),
	);
	return focused;
}

export function usePullRequestLiveUpdates(pullRequest: GithubPullRequestParams): PullRequestLiveUpdates {
	const api = useApi();
	const runtime = useReadyRuntime();
	const queryClient = useQueryClient();
	const toast = useToast();
	const repository = React.useMemo(() => ({ owner: pullRequest.owner, repository: pullRequest.repository }), [pullRequest.owner, pullRequest.repository]);
	const status = api.githubPullRequests.liveUpdates.useQuery(repository);
	const enable = api.githubPullRequests.enableLiveUpdates.useMutation();
	const disable = api.githubPullRequests.disableLiveUpdates.useMutation();
	const [connection, setConnection] = React.useState<ServerEventStreamState | "idle">("idle");
	const focused = useScreenIsFocused();
	const active = useAppIsActive();
	const current = status.data?.data.status;
	const streaming = current === "enabled" && focused && active;

	React.useEffect((): (() => void) | undefined => {
		if (!streaming) {
			return undefined;
		}
		const path = `${apiRoutes.githubPullRequests.liveUpdates.replace(":owner", encodeURIComponent(pullRequest.owner)).replace(":repository", encodeURIComponent(pullRequest.repository))}/events`;
		const stream = openServerEventStream({
			url: buildUrl(runtime.env.apiBaseUrl, path),
			fetch: streamingFetch,
			getAccessToken: () => runtime.tokenProvider.getAccessToken(),
			// Any authenticated read renews an expired access token; one that cannot be renewed ends the session.
			refreshSession: async (): Promise<boolean> => {
				try {
					await api.auth.me.fetchOrThrow(undefined);
					return true;
				} catch {
					return false;
				}
			},
			onEvent: (event: ServerEvent): void => {
				if (event.type === "resync") {
					void refreshPullRequest(queryClient, pullRequest);
					return;
				}
				if (event.type !== "message") {
					return;
				}
				const change = GithubPullRequestChangeSchema.safeParse(JSON.parse(event.data));
				if (change.success && isChangeTo(change.data, pullRequest)) {
					void refreshPullRequest(queryClient, pullRequest);
				}
			},
			onState: setConnection,
		});
		return (): void => {
			stream.close();
		};
	}, [api, pullRequest, queryClient, runtime, streaming]);

	const change = React.useCallback(
		(mutation: typeof enable): void => {
			mutation
				.mutateAsync(repository)
				.then(async (): Promise<void> => {
					await refreshLiveUpdates(queryClient, repository.owner, repository.repository);
				})
				.catch((error: unknown): void => {
					toast.error(errorMessageOf(error instanceof Error ? error : null));
				});
		},
		[queryClient, repository, toast],
	);
	const turnOn = React.useCallback((): void => {
		change(enable);
	}, [change, enable]);
	const turnOff = React.useCallback((): void => {
		change(disable);
	}, [change, disable]);

	return {
		status: status.isPending ? "loading" : current === undefined || current === "off" ? "unavailable" : current,
		// A stream that is not wanted is idle, whatever the last one reported.
		connection: streaming ? connection : "idle",
		isChanging: enable.isPending || disable.isPending,
		turnOn,
		turnOff,
	};
}
