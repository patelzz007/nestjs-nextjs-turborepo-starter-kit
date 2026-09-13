"use client";

import { organizationPath } from "@/lib/organization-slug";
import { useParams } from "next/navigation";
import * as React from "react";

export default function OrganizationTeamPage(): React.JSX.Element {
	const params = useParams();
	const orgSlug = typeof params.orgSlug === "string" ? params.orgSlug : "";

	return (
		<div className="space-y-4 p-6">
			<h1 className="text-xl font-semibold">Team</h1>
			<p className="text-sm text-muted-foreground">
				Invite members and review access requests for this organization. API: <code className="text-xs">POST /orgs/{orgSlug}/members/invite</code>
			</p>
			<a href={organizationPath(orgSlug, "dashboard")} className="text-sm underline">
				Back to dashboard
			</a>
		</div>
	);
}
