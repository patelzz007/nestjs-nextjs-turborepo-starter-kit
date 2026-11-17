"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import * as React from "react";

/** Which environment this deployment is, and whether rule changes here wait for a second person. */
export function EnvironmentNote(): React.JSX.Element | null {
	const { api } = useAuth();
	const environment = api.featureFlags.environment.useQuery(undefined).data?.data;
	if (environment === undefined) {
		return null;
	}
	return (
		<p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
			<StatusBadge tone={environment.environment === "production" ? "danger" : "info"}>{environment.environment}</StatusBadge>
			{environment.approvalsRequired
				? "Rule changes wait for someone else's approval (up to 7 days). Kill switches and overrides apply at once."
				: "Rule changes apply at once here."}
		</p>
	);
}
