import { CircleUserRound, KeyRound, Shield, ShieldCheck, ToggleRight } from "lucide-react";
import type * as React from "react";

import { ROUTES } from "@/lib/routes";

export interface AdminSettingsSection {
	readonly id: string;
	readonly label: string;
	readonly href: string;
	readonly icon: React.ReactNode;
}

export interface AdminSettingsGroup {
	readonly id: string;
	readonly label: string;
	readonly sections: readonly AdminSettingsSection[];
}

/**
 * Settings and the personal account as one page: platform configuration, then the signed-in admin's
 * own sections. Read by the settings page's navigation (a section shows only when the route guard
 * would open it) and by `/settings` itself, which opens the first one the person may see.
 */
export const ADMIN_SETTINGS_SECTIONS: readonly AdminSettingsGroup[] = [
	{
		id: "platform",
		label: "Platform",
		sections: [
			{ id: "access", label: "Access control", href: ROUTES.settings.access, icon: <ShieldCheck /> },
			{ id: "feature-flags", label: "Feature flags", href: ROUTES.settings.featureFlags, icon: <ToggleRight /> },
		],
	},
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

/** The first section `canOpen` allows, in the page's order; the profile (every admin's own) otherwise. */
export function firstSettingsSectionHref(canOpen: (href: string) => boolean): string {
	return ADMIN_SETTINGS_SECTIONS.flatMap((group) => group.sections).find((section) => canOpen(section.href))?.href ?? ROUTES.account.profile;
}

/** The section a path belongs to (its own page or one below it). */
export function activeAdminSettingsSection(pathname: string): string | undefined {
	return ADMIN_SETTINGS_SECTIONS.flatMap((group) => group.sections).find((section) => pathname === section.href || pathname.startsWith(`${section.href}/`))?.id;
}
