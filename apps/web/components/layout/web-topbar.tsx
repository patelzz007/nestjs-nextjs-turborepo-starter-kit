"use client";

import { useWebBreadcrumb } from "@/components/breadcrumb-provider";
import CommandPaletteClientOnly from "@/components/layout/command-palette.client-only";
import { ShellTopbar } from "@workspace/client/lib/features/navigation/shell-topbar";
import type * as React from "react";

/**
 * The web app's page header: the shared `ShellTopbar` with this app's breadcrumb trail and command
 * palette. Theme, settings and the profile menu live in the sidebar's account row.
 */
export function WebTopbar(): React.JSX.Element {
	const { status } = useWebBreadcrumb();
	return <ShellTopbar breadcrumbStatus={status} commandPalette={CommandPaletteClientOnly} />;
}
