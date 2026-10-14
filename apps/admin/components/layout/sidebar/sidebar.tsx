"use client";

import { Button } from "@workspace/ui/components/button";
import { PanelSidebarFooterNav, PanelSidebarNav, PanelSidebarRouteAnnouncer, type PanelSidebarPinnedItem } from "@workspace/ui/components/panel-sidebar-nav";
import type { PanelSidebarLinkProps } from "@workspace/ui/components/panel-sidebar-nav-item";
import { AppShellSidebarAccount } from "@workspace/ui/components/app-shell-sidebar-account";
import { PanelSidebarHeader } from "@workspace/ui/components/panel-sidebar-header";
import { SidebarFooter } from "@workspace/ui/components/sidebar";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import type { SidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import { BrandMark } from "@workspace/ui/components/brand-mark";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import type { FooterAction, SidebarUser } from "@/lib/navigation/sidebar";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import type { AdminShellLabels } from "@/lib/sidebar-labels";

export interface SidebarProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly footerActions?: readonly FooterAction[];
	readonly view: SidebarView;
	/** The current pathname — pinned rows' active state and keeping the current page in view. */
	readonly pathname: string;
	/** The panel nav strings that differ from the kit pack for admin. */
	readonly navLabels?: UiKitLabelsOverride<"panelSidebarNav"> | undefined;
	/** The admin shell's own copy (log-out button). */
	readonly shellLabels: AdminShellLabels;
	readonly searchQuery: string;
	readonly onSearchQueryChange: (query: string) => void;
	readonly expandedItems: Readonly<Record<string, boolean>>;
	readonly onToggleItem: (itemId: string) => void;
	/** A menu or pinned link was followed — closes the branches opened by hand. */
	/** A menu or pinned link was followed, with its `href`. */
	readonly onFollowLink: (href: string) => void;
	readonly onMoveSectionUp: (title: string, allTitles: readonly string[]) => void;
	readonly onMoveSectionDown: (title: string, allTitles: readonly string[]) => void;
	readonly pinnedItems: readonly PanelSidebarPinnedItem[];
	/** The current page's resolved breadcrumb label, announced after navigation. */
	readonly pageLabel: string | null;
	/** Connection and session status, shown above the user row. */
	readonly status?: React.ReactNode;
	/** The profile menu the user row opens (profile, security, settings, log out). */
	readonly profileMenu?: React.ReactNode;
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
	navLabels,
	shellLabels,
	searchQuery,
	onSearchQueryChange,
	expandedItems,
	onToggleItem,
	onFollowLink,
	onMoveSectionUp,
	onMoveSectionDown,
	pinnedItems,
	pageLabel,
	status,
	profileMenu,
}: SidebarProps): React.JSX.Element {
	const menu = SIDEBAR_MENU;

	return (
		<>
			<PanelSidebarHeader title={menu.header.title} icon={<BrandMark className="size-5 text-primary" />} />
			<PanelSidebarNav
				view={view}
				pathname={pathname}
				expandedItems={expandedItems}
				onToggleExpand={onToggleItem}
				onFollowLink={onFollowLink}
				renderLink={renderAdminLink}
				renderIcon={renderAdminIcon}
				searchQuery={searchQuery}
				onSearchQueryChange={onSearchQueryChange}
				pinnedItems={pinnedItems}
				onMoveSectionUp={onMoveSectionUp}
				onMoveSectionDown={onMoveSectionDown}
				labels={navLabels}
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
					onFollowLink={onFollowLink}
					renderLink={renderAdminLink}
					renderIcon={renderAdminIcon}
					searchQuery={searchQuery}
					labels={navLabels}
				/>

				<AppShellSidebarAccount
					name={user.name}
					email={user.email}
					avatar={user.avatar}
					onLogout={onLogout}
					status={status}
					{...(profileMenu === undefined ? {} : { menuContent: profileMenu })}
					labels={{ logout: shellLabels.logoutAriaLabel }}
				/>
			</SidebarFooter>
			<PanelSidebarRouteAnnouncer pageLabel={pageLabel} labels={navLabels} />
		</>
	);
}
