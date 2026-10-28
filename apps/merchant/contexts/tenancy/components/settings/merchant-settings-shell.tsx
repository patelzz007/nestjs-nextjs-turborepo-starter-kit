"use client";

import { canOpenTenantPath } from "@/lib/navigation/tenant-route-authorization";
import { TENANT_ROUTES, tenantPath, toTenantRelativePath, type AppPath } from "@/lib/routes";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { SettingsShell, type SettingsLinkProps, type SettingsNavGroup } from "@workspace/ui/components/settings-shell";
import { BadgeCheck, Ban, Building2, Palette, Plug, ShieldCheck, Store, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

/** One settings section: where it lives (tenant-relative) and how the navigation names it. */
interface SettingsSection {
	readonly id: string;
	readonly label: string;
	readonly path: AppPath;
	readonly icon: React.ReactNode;
}

interface SettingsSectionGroup {
	readonly id: string;
	readonly label: string;
	readonly sections: readonly SettingsSection[];
}

/**
 * Every settings section, grouped. A section is listed only when its page would open for the member (the
 * same `ORG_PAGE_RULES` the page guard enforces), so the navigation never offers a page that denies.
 */
export const MERCHANT_SETTINGS_SECTIONS: readonly SettingsSectionGroup[] = [
	{
		id: "business",
		label: "Business",
		sections: [
			{ id: "profile", label: "Business profile", path: TENANT_ROUTES.settings.index, icon: <Building2 /> },
			{ id: "team", label: "Team & permissions", path: TENANT_ROUTES.settings.team, icon: <Users /> },
			{ id: "locations", label: "Stores", path: TENANT_ROUTES.settings.locations, icon: <Store /> },
			{ id: "branding", label: "Branding", path: TENANT_ROUTES.settings.branding, icon: <Palette /> },
			{ id: "verification", label: "Business verification", path: TENANT_ROUTES.settings.verification, icon: <BadgeCheck /> },
			{ id: "banned", label: "Banned customers", path: TENANT_ROUTES.settings.bannedCustomers, icon: <Ban /> },
		],
	},
	{ id: "personal", label: "Personal", sections: [{ id: "security", label: "Security", path: TENANT_ROUTES.account, icon: <ShieldCheck /> }] },
	{ id: "developers", label: "Developers", sections: [{ id: "integrations", label: "Integrations", path: TENANT_ROUTES.settings.integrations, icon: <Plug /> }] },
];

/** The section a tenant-relative path belongs to: the longest section path it starts with. */
export function activeSettingsSection(tenantRelativePath: string | undefined): string | undefined {
	if (tenantRelativePath === undefined) {
		return undefined;
	}
	const sections = MERCHANT_SETTINGS_SECTIONS.flatMap((group) => group.sections);
	const matches = sections.filter((section) => tenantRelativePath === section.path || tenantRelativePath.startsWith(`${section.path}/`));
	return matches.reduce<SettingsSection | undefined>((best, section) => (best === undefined || section.path.length > best.path.length ? section : best), undefined)?.id;
}

function renderLink(href: string): React.ReactElement<SettingsLinkProps> {
	return <Link href={href} />;
}

export interface MerchantSettingsShellProps {
	readonly tenantSlug: string;
	readonly children: React.ReactNode;
}

/** Settings for one business: the sections the member may open on the left, the open one on the right. */
export function MerchantSettingsShell({ tenantSlug, children }: MerchantSettingsShellProps): React.JSX.Element {
	const pathname = usePathname();
	const { can } = useAuthorization();
	const { api } = useAuth();
	const canManageTeam = can(MERCHANT_CAPABILITY.manageTeam);
	// Waiting invitations, counted by the API (one row asked for; the total is in `meta`).
	const invitesQuery = api.tenants.listMemberInvites.useQuery({ tenantSlug, page: 1, limit: 1 }, { enabled: canManageTeam });
	const pendingInvites = canManageTeam ? readPaginatedTotal(invitesQuery.data?.meta, 0) : 0;

	const groups: readonly SettingsNavGroup[] = MERCHANT_SETTINGS_SECTIONS.map((group) => ({
		id: group.id,
		label: group.label,
		items: group.sections
			.filter((section) => canOpenTenantPath(section.path, can))
			.map((section) => ({
				id: section.id,
				label: section.label,
				href: tenantPath(tenantSlug, section.path),
				icon: section.icon,
				...(section.id === "team" ? { badge: pendingInvites } : {}),
			})),
	}));

	return (
		<SettingsShell
			title="Settings"
			description="Your business, your team and how the merchant console works for you."
			groups={groups}
			activeItemId={activeSettingsSection(toTenantRelativePath(pathname))}
			renderLink={renderLink}
			navLabel="Settings sections">
			{children}
		</SettingsShell>
	);
}
