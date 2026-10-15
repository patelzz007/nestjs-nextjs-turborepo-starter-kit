// One of a pull request's commits with its diff — pushed from the pull request's commits.

import type { GithubPullRequestCommitParams } from "@workspace/shared";
import * as React from "react";

import { PullRequestCommitScreen } from "../../../features/github-pull-requests/pull-request-commit-screen";
import { PullRequestCommitRoute } from "../../../features/github-pull-requests/pull-request-route";

function render(commit: GithubPullRequestCommitParams): React.JSX.Element {
	return <PullRequestCommitScreen commit={commit} />;
}

export default function PullRequestCommitScreenRoute(): React.JSX.Element {
	return <PullRequestCommitRoute render={render} />;
}
