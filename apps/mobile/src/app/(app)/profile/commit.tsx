// ============================================
// A GitHub commit — pushed from the Profile's commit history
// ============================================
// `?owner=&repository=&sha=` arrive from the URL (a deep link included), so
// they are parsed with the shared contract before anything is read; a link
// that does not name a commit says so instead of asking the API.

import { GithubCommitParamsSchema } from "@workspace/shared";
import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { z } from "zod";

import { Alert } from "@workspace/ui-native/components/alert";
import { Screen } from "../../../components/screen";
import { GithubCommitDetailScreen } from "../../../features/github/github-commit-detail";

/** The route's params: the contract's commit params, other search params ignored. */
const CommitRouteParamsSchema = z.object(GithubCommitParamsSchema.shape);

export const INVALID_COMMIT_LINK_MESSAGE = "This link doesn't point to a commit. Go back and pick one from the commit history.";

export default function GithubCommitScreen(): React.JSX.Element {
	const params = CommitRouteParamsSchema.safeParse(useLocalSearchParams());
	if (!params.success) {
		return (
			<Screen>
				<Alert tone="error" message={INVALID_COMMIT_LINK_MESSAGE} />
			</Screen>
		);
	}
	return <GithubCommitDetailScreen commit={params.data} />;
}
