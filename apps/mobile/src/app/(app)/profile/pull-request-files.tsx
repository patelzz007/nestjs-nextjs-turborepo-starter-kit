// A pull request's changed files — pushed from the pull request.

import type { GithubPullRequestParams } from "@workspace/shared";
import * as React from "react";

import { PullRequestFilesScreen, PullRequestRoute } from "../../../contexts/integrations-github";

function render(pullRequest: GithubPullRequestParams): React.JSX.Element {
	return <PullRequestFilesScreen pullRequest={pullRequest} />;
}

export default function PullRequestFilesScreenRoute(): React.JSX.Element {
	return <PullRequestRoute render={render} />;
}
