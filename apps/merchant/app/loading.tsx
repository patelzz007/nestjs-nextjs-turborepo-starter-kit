import { MerchantWorkspaceSkeleton } from "@/components/loading/merchant-page-skeletons";
import { readSidebarOpen } from "@/lib/merchant-server-api";
import type * as React from "react";

/** A sidebar with no saved state starts open, as the sidebar store does. */
const DEFAULT_SIDEBAR_OPEN = true;

/**
 * The entry routes (`/`, `/account`) while they resolve the member's organization and redirect into its workspace —
 * and the org shell while its layout loads. Reads the same sidebar cookie as the org layout, so the outline opens or
 * collapses the sidebar exactly as the workspace will.
 */
export default async function MerchantEntryLoading(): Promise<React.JSX.Element> {
	return <MerchantWorkspaceSkeleton sidebarOpen={(await readSidebarOpen()) ?? DEFAULT_SIDEBAR_OPEN} />;
}
