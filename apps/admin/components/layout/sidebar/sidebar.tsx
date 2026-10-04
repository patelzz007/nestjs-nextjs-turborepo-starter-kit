"use client";

import { Button } from "@workspace/ui/components/form/button";
import { PanelSidebarFooterNav, PanelSidebarNav, PanelSidebarRouteAnnouncer, type PanelSidebarPinnedItem } from "@workspace/ui/components/navigation/panel-sidebar-nav";
import type { PanelSidebarLinkProps } from "@workspace/ui/components/navigation/panel-sidebar-nav-item";
import { SidebarFooter, SidebarHeader } from "@workspace/ui/components/navigation/sidebar";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import type { SidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import { AlertCircle, LogOut } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import type { FooterAction, SidebarUser } from "@/lib/navigation/sidebar";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import type { AdminSidebarLabels } from "@/lib/sidebar-labels";

export interface SidebarProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly footerActions?: readonly FooterAction[];
	readonly view: SidebarView;
	/** The current pathname — pinned rows' active state and keeping the current page in view. */
	readonly pathname: string;
	readonly labels: AdminSidebarLabels;
	readonly searchQuery: string;
	readonly onSearchQueryChange: (query: string) => void;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly onToggleItem: (itemId: string) => void;
	readonly onMoveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly onMoveSectionDown: (title: string, allTitles: readonly string[]) => void;
	readonly pinnedItems: readonly PanelSidebarPinnedItem[];
	/** The current page's resolved breadcrumb label, announced after navigation. */
	readonly pageLabel: string | null;
}

function renderAdminLink(href: string): React.ReactElement<PanelSidebarLinkProps> {
	return <Link href={href} />;
}

function renderAdminIcon(iconName: string | undefined, className: string): React.ReactNode {
	const Icon = iconName !== undefined ? (ICON_MAP[iconName] ?? AlertCircle) : AlertCircle;
	return <Icon className={className} aria-hidden="true" />;
}

/** Admin sidebar panel — props only; state lives in `DashboardLayout`. */
export function AdminSidebarPanel({
	user,
	onLogout,
	footerActions = [],
	view,
	pathname,
	labels,
	searchQuery,
	onSearchQueryChange,
	expandedItems,
	onToggleItem,
	onMoveSectionUp,
	onMoveSectionDown,
	pinnedItems,
	pageLabel,
}: SidebarProps): React.JSX.Element {
	const menu = SIDEBAR_MENU;

	return (
		<>
			<SidebarHeader className="h-14 border-b border-sidebar-border">
				<div className="flex h-full min-w-0 items-center gap-3 px-2">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent ring-1 ring-sidebar-border/50">
						<span className="text-sm font-bold text-sidebar-foreground">{getUserInitials(menu.header.title)}</span>
					</div>
					<div className="min-w-0 flex-1">
						<span className="block truncate text-sm font-semibold text-sidebar-foreground" title={menu.header.title}>
							{menu.header.title}
						</span>
					</div>
				</div>
			</SidebarHeader>
			<PanelSidebarNav
				view={view}
				pathname={pathname}
				expandedItems={expandedItems}
				onToggleExpand={onToggleItem}
				renderLink={renderAdminLink}
				renderIcon={renderAdminIcon}
				searchQuery={searchQuery}
				onSearchQueryChange={onSearchQueryChange}
				pinnedItems={pinnedItems}
				onMoveSectionUp={onMoveSectionUp}
				onMoveSectionDown={onMoveSectionDown}
				labels={labels}
			/>
			<SidebarFooter className="border-t border-sidebar-border bg-sidebar-accent/10">
				{footerActions.length > 0 ? (
					<div className="flex items-center gap-1 px-2">
						{footerActions.map((action) => (
							<Button
								key={action.label}
								type="button"
								variant="ghost"
								size="xs"
								onClick={action.onClick}
								className="gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
								<action.icon className="h-3.5 w-3.5" aria-hidden="true" />
								<span>{action.label}</span>
							</Button>
						))}
					</div>
				) : null}

				<PanelSidebarFooterNav
					view={view}
					expandedItems={expandedItems}
					onToggleExpand={onToggleItem}
					renderLink={renderAdminLink}
					renderIcon={renderAdminIcon}
					searchQuery={searchQuery}
					labels={labels}
				/>

				<div className="flex items-center justify-between px-2 py-2">
					<div className="flex min-w-0 items-center gap-2.5">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[length:var(--text-sidebar-caption)] font-bold text-sidebar-foreground ring-1 ring-sidebar-border/50">
							{getUserInitials(user.name)}
						</div>
						<div className="min-w-0">
							<span className="block truncate text-sm leading-tight font-medium text-sidebar-foreground" title={user.name}>
								{user.name}
							</span>
							<span className="block truncate text-[length:var(--text-sidebar-caption)] leading-tight text-muted-foreground" title={user.email}>
								{user.email}
							</span>
						</div>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={onLogout}
						className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
						aria-label={labels.logoutAriaLabel}
						title={labels.logoutTitle}>
						<LogOut className="h-3.5 w-3.5" aria-hidden="true" />
					</Button>
				</div>
			</SidebarFooter>
			<PanelSidebarRouteAnnouncer pageLabel={pageLabel} labels={labels} />
		</>
	);
}
