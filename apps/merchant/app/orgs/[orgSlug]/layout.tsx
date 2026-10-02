import { OrgTenantBootstrap } from "@/components/org/org-tenant-bootstrap";
import { MerchantShell } from "@/components/merchant-shell";
import { getMerchantServerSession } from "@/lib/auth/server";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { isCanonicalOrganizationSlug, resolveOrganizationTenantFromUrlSegment } from "@/lib/org/resolve-slug";
import { loadServerLocationScope, type ServerLocationScope } from "@/lib/org/server-location-scope";
import { ORGANIZATION_SLUG_COOKIE_NAME } from "@/lib/org/slug";
import { orgRoutes, ROUTES } from "@/lib/routes";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface OrgLayoutProps {
	readonly children: React.ReactNode;
	readonly params: Promise<{ orgSlug: string }>;
}

export const dynamic = "force-dynamic";

export default async function OrgLayout({ children, params }: OrgLayoutProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const ctx = await loadMerchantServerContext();
	const session = await getMerchantServerSession();
	const resolvedTenant = resolveOrganizationTenantFromUrlSegment(ctx.memberships, orgSlug);

	if (!isCanonicalOrganizationSlug(orgSlug)) {
		if (resolvedTenant === undefined) {
			const cookieStore = await cookies();
			const storedSlug = cookieStore.get(ORGANIZATION_SLUG_COOKIE_NAME)?.value;
			if (storedSlug !== undefined && isCanonicalOrganizationSlug(storedSlug)) {
				redirect(orgRoutes(storedSlug).dashboard);
			}
			redirect(ROUTES.onboarding);
		}
		redirect(orgRoutes(resolvedTenant.slug).dashboard);
	}

	if (resolvedTenant === undefined) {
		const cookieStore = await cookies();
		const storedSlug = cookieStore.get(ORGANIZATION_SLUG_COOKIE_NAME)?.value;
		if (storedSlug !== undefined && isCanonicalOrganizationSlug(storedSlug) && storedSlug !== orgSlug) {
			redirect(orgRoutes(storedSlug).dashboard);
		}
	}

	// Seeds the tenant context (store filter + accessible locations) so the first client render
	// asks for exactly the store the pages prefetch. Skipped for a non-member: the page guard denies.
	const locationScope: ServerLocationScope | undefined = resolvedTenant !== undefined ? await loadServerLocationScope(orgSlug) : undefined;

	return (
		<MerchantShell
			orgSlug={orgSlug}
			initialLocationId={locationScope?.selectedLocationId ?? null}
			initialOrganizationContext={locationScope?.organizationContext}
			initialMemberships={ctx.memberships}
			initialUser={session.user}
			initialIsImpersonating={session.isImpersonating}>
			{resolvedTenant !== undefined ? <OrgTenantBootstrap orgSlug={resolvedTenant.slug} /> : null}
			{children}
		</MerchantShell>
	);
}
