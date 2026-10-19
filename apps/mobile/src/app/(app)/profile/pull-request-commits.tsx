// A pull request's commits — pushed from the pull request.

import type { GithubPullRequestParams } from "@workspace/shared";
import * as React from "react";

import { PullRequestCommitsScreen, PullRequestRoute } from "../../../contexts/integrations-github";

function render(pullRequest: GithubPullRequestParams): React.JSX.Element {
	return <PullRequestCommitsScreen pullRequest={pullRequest} />;
}

export default function PullRequestCommitsScreenRoute(): React.JSX.Element {
	return <PullRequestRoute render={render} />;
}
