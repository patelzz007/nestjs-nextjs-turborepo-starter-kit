import { OrgTenantBootstrap } from "@/components/org/org-tenant-bootstrap";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { isCanonicalOrganizationSlug, resolveOrganizationTenantFromUrlSegment } from "@/lib/org/resolve-slug";
import { organizationPath, ORGANIZATION_SLUG_COOKIE_NAME } from "@/lib/org/slug";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface OrgLayoutProps {
	readonly children: React.ReactNode;
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const ctx = await loadMerchantServerContext();
	const resolvedTenant = resolveOrganizationTenantFromUrlSegment(ctx.memberships, orgSlug);

	if (!isCanonicalOrganizationSlug(orgSlug)) {
		if (resolvedTenant === undefined) {
			redirect("/");
		}
		if (resolvedTenant.slug !== null) {
			redirect(organizationPath(resolvedTenant.slug, "dashboard"));
		}
	}

	if (resolvedTenant === undefined) {
		const cookieStore = await cookies();
		const storedSlug = cookieStore.get(ORGANIZATION_SLUG_COOKIE_NAME)?.value;
		if (storedSlug !== undefined && isCanonicalOrganizationSlug(storedSlug) && storedSlug !== orgSlug) {
			redirect(organizationPath(storedSlug, "dashboard"));
		}
	}

	return (
		<>
			{resolvedTenant !== undefined ? <OrgTenantBootstrap merchantOrgId={resolvedTenant.merchantOrgId} orgSlug={resolvedTenant.slug} /> : null}
			{children}
		</>
	);
}
