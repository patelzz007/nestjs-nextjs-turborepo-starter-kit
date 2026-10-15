// The admin's GitHub token (ADR 052) — opened from the drawer or a "Link a token" prompt.

import * as React from "react";

import { GithubAccountScreen } from "../../../features/github-pull-requests/github-account-screen";

export default function GithubAccountRoute(): React.JSX.Element {
	return <GithubAccountScreen />;
}
