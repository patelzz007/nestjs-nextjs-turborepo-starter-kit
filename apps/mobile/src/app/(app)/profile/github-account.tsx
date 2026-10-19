// The admin's GitHub token (ADR 052) — opened from the drawer or a "Link a token" prompt.

import * as React from "react";

import { GithubAccountScreen } from "../../../contexts/integrations-github";

export default function GithubAccountRoute(): React.JSX.Element {
	return <GithubAccountScreen />;
}
