// The admin's GitHub pull requests (ADR 052) — opened from the drawer.

import * as React from "react";

import { PullRequestListScreen } from "../../../features/github-pull-requests/pull-request-list-screen";

export default function PullRequestsRoute(): React.JSX.Element {
	return <PullRequestListScreen />;
}
