import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { GITHUB_URL, SITE_NAME } from "@/lib/site";

/**
 * Shared options for the docs layout (search + theme toggles). Both the
 * desktop shell and any future secondary layout consume these so the chrome
 * stays identical everywhere. The theme switch renders in the navbar
 * (desktop) and inside the mobile drawer (the Fumadocs `SidebarDrawer`), so
 * dark mode is reachable on every breakpoint. External links (admin panel,
 * Swagger) intentionally live in the footer, not the sidebar.
 */
export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: (
				<div className="flex items-center gap-2.5">
					{/* Brand mark — the inverted slate-800/white pill used across the admin. */}
					<span className="bg-fd-primary text-fd-primary-foreground flex size-7 items-center justify-center rounded-lg text-sm font-bold">M</span>
					<span className="font-heading text-base font-semibold tracking-tight">{SITE_NAME}</span>
				</div>
			),
		},
		githubUrl: GITHUB_URL,
		searchToggle: {
			enabled: true,
		},
		themeSwitch: {
			enabled: true,
		},
	};
}
