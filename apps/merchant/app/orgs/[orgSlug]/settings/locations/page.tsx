"use client";

import { OrganizationLocationsPageView } from "@/components/org/organization-locations-page-view";
import { useParams } from "next/navigation";
import * as React from "react";

export default function OrganizationLocationsPage(): React.JSX.Element {
	const params = useParams();
	const orgSlug = typeof params.orgSlug === "string" ? params.orgSlug : "";

	return <OrganizationLocationsPageView orgSlug={orgSlug} />;
}
