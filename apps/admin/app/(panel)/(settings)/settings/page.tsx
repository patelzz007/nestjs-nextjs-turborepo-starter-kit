import { createGrantedCapabilities, isCapabilityGranted } from "@workspace/client/lib/contexts/authorization/permission-check";
import type { CapabilitySlug } from "@workspace/shared";
import { redirect } from "next/navigation";

import { loadAdminServerSession } from "@/lib/auth-server";
import { ADMIN_ROUTE_AUTHORIZATION, canAccessRoute, type RouteAccessSession } from "@/lib/navigation/route-authorization";
import { firstSettingsSectionHref } from "@/lib/navigation/settings-sections";
import { ROUTES } from "@/lib/routes";
import { loadEnabledFeatureFlags } from "@/lib/server/feature-flag-settings";

/**
 * `/settings` — the sidebar's Settings link (one link, no dropdown: enhancement 5.13). Opens the first
 * section this admin may see, by the route guard's own rules: Access control for those allowed it, their
 * Profile otherwise (every admin's own). When the session can't be read, the profile is the safe landing.
 * Server-side `redirect()` throws during render — no client flash.
 */
export default async function SettingsIndexPage(): Promise<React.ReactNode> {
	const [session, enabledFeatureFlags] = await Promise.all([loadAdminServerSession(), loadEnabledFeatureFlags()]);
	if (session.kind === "signed-out") {
		redirect(ROUTES.auth.login);
	}
	if (session.kind === "unavailable") {
		redirect(ROUTES.account.profile);
	}
	const granted = createGrantedCapabilities(session.session.permissions.data.capabilities);
	const access: RouteAccessSession = {
		isGranted: (permission: CapabilitySlug): boolean => isCapabilityGranted(granted, permission),
		enabledFeatureFlags,
		isSuperAdmin: session.session.profile.data.isSuperAdmin,
	};
	redirect(firstSettingsSectionHref((href: string): boolean => canAccessRoute(ADMIN_ROUTE_AUTHORIZATION, href, access)));
}
