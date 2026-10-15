// A pull request's commits — pushed from the pull request.

import type { GithubPullRequestParams } from "@workspace/shared";
import * as React from "react";

import { PullRequestRoute } from "../../../features/github-pull-requests/pull-request-route";
import { PullRequestCommitsScreen } from "../../../features/github-pull-requests/pull-request-commits-screen";

function render(pullRequest: GithubPullRequestParams): React.JSX.Element {
	return <PullRequestCommitsScreen pullRequest={pullRequest} />;
}

export default function PullRequestCommitsScreenRoute(): React.JSX.Element {
	return <PullRequestRoute render={render} />;
}
