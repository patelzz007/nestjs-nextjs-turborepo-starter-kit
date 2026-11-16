// The drawer's groups for this session (the drawer and the command palette read the same list): the menu
// filtered by the session's capabilities (`GET /auth/permissions`) and the flags that are on.

import * as React from "react";

import { useGithubPullRequestAccess } from "../../contexts/integrations-github";
import { useReadyRuntime } from "../../runtime/runtime-context";
import { useCapabilities } from "../authorization/facade";
import { drawerGroupsFor, enabledDrawerFeatureFlags, type DrawerGroup } from "./drawer-destinations";

export function useDrawerGroups(): readonly DrawerGroup[] {
	const capabilities = useCapabilities();
	const { showcase } = useReadyRuntime().env;
	// Pull requests wait on the server too: someone allowed to use them sees nothing while it has them off.
	const githubPullRequests = useGithubPullRequestAccess().kind === "available";
	return React.useMemo(
		(): readonly DrawerGroup[] => drawerGroupsFor({ capabilities, enabledFeatureFlags: enabledDrawerFeatureFlags({ showcase, githubPullRequests }) }),
		[capabilities, githubPullRequests, showcase],
	);
}
