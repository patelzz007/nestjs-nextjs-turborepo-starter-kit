"use client";

import { useCanAccessRoute } from "@/components/layout/authorized-navigation";
import { ADMIN_SETTINGS_SECTIONS, activeAdminSettingsSection } from "@/lib/navigation/settings-sections";
import { SettingsShell, type SettingsLinkProps, type SettingsNavGroup } from "@workspace/ui/components/settings-shell";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

function renderLink(href: string): React.ReactElement<SettingsLinkProps> {
	return <Link href={appRoute(href)} />;
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
