// One pull request — pushed from the pull-request list.

import type { GithubPullRequestParams } from "@workspace/shared";
import * as React from "react";

import { PullRequestRoute } from "../../../features/github-pull-requests/pull-request-route";
import { PullRequestScreen } from "../../../features/github-pull-requests/pull-request-screen";

function render(pullRequest: GithubPullRequestParams): React.JSX.Element {
	return <PullRequestScreen pullRequest={pullRequest} />;
}

export default function PullRequestScreenRoute(): React.JSX.Element {
	return <PullRequestRoute render={render} />;
}
