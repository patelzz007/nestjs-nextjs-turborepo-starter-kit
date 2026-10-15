// A pull request's changed files — pushed from the pull request.

import type { GithubPullRequestParams } from "@workspace/shared";
import * as React from "react";

import { PullRequestRoute } from "../../../features/github-pull-requests/pull-request-route";
import { PullRequestFilesScreen } from "../../../features/github-pull-requests/pull-request-files-screen";

function render(pullRequest: GithubPullRequestParams): React.JSX.Element {
	return <PullRequestFilesScreen pullRequest={pullRequest} />;
}

export default function PullRequestFilesScreenRoute(): React.JSX.Element {
	return <PullRequestRoute render={render} />;
}
