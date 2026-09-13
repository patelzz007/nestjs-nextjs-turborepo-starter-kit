"use client";

import { OrganizationTeamPageView } from "@/components/org/organization-team-page-view";
import { useParams } from "next/navigation";
import * as React from "react";

export default function OrganizationTeamPage(): React.JSX.Element {
	const params = useParams();
	const orgSlug = typeof params.orgSlug === "string" ? params.orgSlug : "";

	return <OrganizationTeamPageView orgSlug={orgSlug} />;
}
