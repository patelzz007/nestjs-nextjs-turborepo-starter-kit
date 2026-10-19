// One pull request — pushed from the pull-request list.

import type { GithubPullRequestParams } from "@workspace/shared";
import * as React from "react";

import { PullRequestRoute, PullRequestScreen } from "../../../contexts/integrations-github";

function render(pullRequest: GithubPullRequestParams): React.JSX.Element {
	return <PullRequestScreen pullRequest={pullRequest} />;
}

export default function PullRequestScreenRoute(): React.JSX.Element {
	return <PullRequestRoute render={render} />;
}
