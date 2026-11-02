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
import { apiRoutes, GithubPullRequestChangeSchema, isChangeTo, type GithubLiveUpdatesStatus, type GithubPullRequestParams } from "@workspace/shared";
import { useFocusEffect } from "expo-router";
import * as React from "react";

import { openApiEventStream } from "../../../lib/api-event-stream";
import { useApi } from "../../../lib/api-context";
import { useAppActive } from "../../../lib/use-app-active";
import { errorMessageOf } from "../../../lib/error-messages";
import type { ServerEvent, ServerEventStreamState } from "../../../lib/server-events";
import { useReadyRuntime } from "../../../runtime/runtime-context";
import { useToast } from "../../../features/toast/facade";
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
	const active = useAppActive();
	const current = status.data?.data.status;
	const streaming = current === "enabled" && focused && active;

	React.useEffect((): (() => void) | undefined => {
		if (!streaming) {
			return undefined;
		}
		const path = `${apiRoutes.githubPullRequests.liveUpdates.replace(":owner", encodeURIComponent(pullRequest.owner)).replace(":repository", encodeURIComponent(pullRequest.repository))}/events`;
		const stream = openApiEventStream({
			runtime,
			api,
			path,
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
