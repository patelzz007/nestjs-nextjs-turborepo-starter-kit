// The guard every pull-request route shares: `?owner=&repository=&number=`
// arrive from the URL (a deep link included), so they are parsed with the
// shared contract before anything is read; a link that does not name a pull
// request says so instead of asking the API.

import type { GithubPullRequestCommitParams, GithubPullRequestParams } from "@workspace/shared";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";

import { Alert } from "@workspace/ui-native/components/alert";
import { Screen } from "../../../components/screen";
import { INVALID_PULL_REQUEST_COMMIT_LINK_MESSAGE, INVALID_PULL_REQUEST_LINK_MESSAGE } from "./labels";
import { PullRequestCommitRouteParamsSchema, PullRequestRouteParamsSchema } from "./route-params";

export interface PullRequestRouteProps {
	readonly render: (pullRequest: GithubPullRequestParams) => React.JSX.Element;
}

export function PullRequestRoute({ render }: PullRequestRouteProps): React.JSX.Element {
	const params = PullRequestRouteParamsSchema.safeParse(useLocalSearchParams());
	if (!params.success) {
		return (
			<Screen>
				<Alert tone="error" message={INVALID_PULL_REQUEST_LINK_MESSAGE} />
			</Screen>
		);
	}
	return render(params.data);
}

export interface PullRequestCommitRouteProps {
	readonly render: (commit: GithubPullRequestCommitParams) => React.JSX.Element;
}

/** The same guard for one of a pull request's commits (`&sha=` as well). */
export function PullRequestCommitRoute({ render }: PullRequestCommitRouteProps): React.JSX.Element {
	const params = PullRequestCommitRouteParamsSchema.safeParse(useLocalSearchParams());
	if (!params.success) {
		return (
			<Screen>
				<Alert tone="error" message={INVALID_PULL_REQUEST_COMMIT_LINK_MESSAGE} />
			</Screen>
		);
	}
	return render(params.data);
}
