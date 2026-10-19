// One of a pull request's commits with its diff — pushed from the pull request's commits.

import type { GithubPullRequestCommitParams } from "@workspace/shared";
import * as React from "react";

import { PullRequestCommitRoute, PullRequestCommitScreen } from "../../../contexts/integrations-github";

function render(commit: GithubPullRequestCommitParams): React.JSX.Element {
	return <PullRequestCommitScreen commit={commit} />;
}

export default function PullRequestCommitScreenRoute(): React.JSX.Element {
	return <PullRequestCommitRoute render={render} />;
}
