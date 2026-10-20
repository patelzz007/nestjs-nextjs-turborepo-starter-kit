// ============================================
// One of a pull request's commits (ADR 052)
// ============================================
// The same commit page as the Profile's (message, author, SHA, parents, every
// changed file with its diff), read with the admin's own linked token — so it
// works for any repository the token can see, private ones included.

import type { GithubPullRequestCommitParams } from "@workspace/shared";
import * as React from "react";

import { useApi } from "../../../lib/api-context";
import { CommitDetailFrame } from "../github/github-commit-detail";

export interface PullRequestCommitScreenProps {
	readonly commit: GithubPullRequestCommitParams;
}

export function PullRequestCommitScreen({ commit }: PullRequestCommitScreenProps): React.JSX.Element {
	const api = useApi();
	return <CommitDetailFrame detail={api.githubPullRequests.commit.useQuery(commit)} testID="pull-request-commit" />;
}
