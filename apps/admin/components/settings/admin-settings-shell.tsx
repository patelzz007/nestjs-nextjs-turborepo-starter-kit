"use client";

import { useCanAccessRoute } from "@/components/layout/authorized-navigation";
import { ROUTES } from "@/lib/routes";
import { SettingsShell, type SettingsLinkProps, type SettingsNavGroup } from "@workspace/ui/components/settings-shell";
import { CircleUserRound, KeyRound, Shield, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

interface AdminSettingsSection {
	readonly id: string;
	readonly label: string;
	readonly href: string;
	readonly icon: React.ReactNode;
}

/**
 * Settings and the personal account as one page: platform configuration, then the signed-in admin's
 * own sections. A section is listed only when the route guard would open it (the same rules).
 */
export const ADMIN_SETTINGS_SECTIONS: readonly { readonly id: string; readonly label: string; readonly sections: readonly AdminSettingsSection[] }[] = [
	{ id: "platform", label: "Platform", sections: [{ id: "access", label: "Access control", href: ROUTES.settings.access, icon: <ShieldCheck /> }] },
	{
		id: "personal",
		label: "Personal",
		sections: [
			{ id: "profile", label: "Profile", href: ROUTES.account.profile, icon: <CircleUserRound /> },
			{ id: "security", label: "Security", href: ROUTES.account.security, icon: <Shield /> },
			{ id: "github", label: "GitHub token", href: ROUTES.account.github, icon: <KeyRound /> },
		],
	},
];

/** The section a path belongs to (its own page or one below it). */
export function activeAdminSettingsSection(pathname: string): string | undefined {
	return ADMIN_SETTINGS_SECTIONS.flatMap((group) => group.sections).find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`))?.id;
}

function renderLink(href: string): React.ReactElement<SettingsLinkProps> {
	return <Link href={href} />;
}

/** The admin settings page: sections on the left, the open one on the right. */
export function AdminSettingsShell({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	const pathname = usePathname();
	const canAccessRoute = useCanAccessRoute();
	const groups: readonly SettingsNavGroup[] = ADMIN_SETTINGS_SECTIONS.map((group) => ({
		id: group.id,
		label: group.label,
		items: group.sections
			.filter((section) => canAccessRoute(section.href))
			.map((section) => ({ id: section.id, label: section.label, href: section.href, icon: section.icon })),
	}));

	return (
		<SettingsShell
			title="Settings"
			description="How the platform is run, and your own account."
			groups={groups}
			activeItemId={activeAdminSettingsSection(pathname)}
			renderLink={renderLink}
			navLabel="Settings sections">
			{children}
		</SettingsShell>
	);
}
