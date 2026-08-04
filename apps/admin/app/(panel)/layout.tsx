"use client";

import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";

export interface PanelLayoutProps {
	readonly children: React.ReactNode;
}

/**
 * Route-group layout for every authenticated admin page (`/`, `/settings/*`,
 * …). Rendering `DashboardShell` here — instead of inside each page — keeps
 * the sidebar, topbar, and footer **mounted across navigations**: Next.js only
 * swaps the `children` segment, so navigation is SPA-like and the chrome never
 * resets (search, expand/collapse, and animations all persist).
 */
export default function PanelLayout({ children }: PanelLayoutProps): React.JSX.Element {
	return <DashboardShell>{children}</DashboardShell>;
}
