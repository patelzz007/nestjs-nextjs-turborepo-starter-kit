import { guardOrgPage } from "@/lib/org/org-page-guard";
import { orgRoutes } from "@/lib/routes";
import { redirect } from "next/navigation";

interface OrgDashboardPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/** Organization root — the dashboard is the org's landing page. */
export default async function OrgDashboardPage({ params }: OrgDashboardPageProps): Promise<React.ReactNode> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/");
	if (denied !== null) {
		return denied;
	}
	redirect(orgRoutes(orgSlug).dashboard);
}
