import { AdminSettingsShell } from "@/components/settings/admin-settings-shell";
import type * as React from "react";

/**
 * Settings and the personal account share one page: their sections on the left, the open one on the right.
 * A route group, so `/settings/*` and `/account/*` sit under this ONE layout: switching between Platform and
 * Personal sections swaps only the section, and the navigation is never re-mounted.
 */
export default function SettingsSectionLayout({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return <AdminSettingsShell>{children}</AdminSettingsShell>;
}
