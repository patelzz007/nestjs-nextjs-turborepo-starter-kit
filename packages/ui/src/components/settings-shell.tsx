"use client";

import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** The props the shell sets on the app's link element (a Next.js `<Link>` or a plain `<a>`). */
export type SettingsLinkProps = Pick<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "aria-current" | "children">;

/** Returns the app's BARE link element for `href` (e.g. `<Link href={href} />`); keeps this package free of any router. */
export type SettingsRenderLink = (href: string) => React.ReactElement<SettingsLinkProps>;

export interface SettingsNavItem {
	readonly id: string;
	readonly label: string;
	readonly href: string;
	/** A decorative icon (hidden from assistive technology — the label names the item). */
	readonly icon?: React.ReactNode;
	/** Something waiting in the section (e.g. pending invitations); hidden at 0. */
	readonly badge?: number;
}

export interface SettingsNavGroup {
	readonly id: string;
	readonly label: string;
	readonly items: readonly SettingsNavItem[];
}

export interface SettingsShellProps {
	readonly title: string;
	readonly description: string;
	/** The sections, grouped. Empty groups are not drawn. */
	readonly groups: readonly SettingsNavGroup[];
	/** The section on screen (its item is marked `aria-current="page"`). */
	readonly activeItemId: string | undefined;
	readonly renderLink: SettingsRenderLink;
	/** Names the navigation landmark for screen readers. */
	readonly navLabel: string;
	readonly className?: string;
	readonly children: React.ReactNode;
}

/**
 * Settings, as one page with its own navigation: the title, then the sections grouped on the left (above
 * the content on small screens) and the chosen section on the right. Data-agnostic: the app decides
 * which sections exist and which one is open.
 */
export function SettingsShell({ title, description, groups, activeItemId, renderLink, navLabel, className, children }: SettingsShellProps): React.JSX.Element {
	return (
		<div className={cn("space-y-8", className)}>
			<header className="space-y-1.5">
				<h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
				<p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
			</header>
			<div className="grid gap-8 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10">
				<nav aria-label={navLabel} className="space-y-6 lg:sticky lg:top-6 lg:self-start">
					{groups
						.filter((group) => group.items.length > 0)
						.map((group) => (
							<div key={group.id} className="space-y-1.5">
								<p id={`settings-group-${group.id}`} className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
									{group.label}
								</p>
								<ul aria-labelledby={`settings-group-${group.id}`} className="grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
									{group.items.map((item) => (
										<li key={item.id}>
											<SettingsNavLink item={item} active={item.id === activeItemId} renderLink={renderLink} />
										</li>
									))}
								</ul>
							</div>
						))}
				</nav>
				<div className="min-w-0 space-y-6">{children}</div>
			</div>
		</div>
	);
}

interface SettingsNavLinkProps {
	readonly item: SettingsNavItem;
	readonly active: boolean;
	readonly renderLink: SettingsRenderLink;
}

function SettingsNavLink({ item, active, renderLink }: SettingsNavLinkProps): React.JSX.Element {
	const badge = item.badge ?? 0;
	return React.cloneElement(renderLink(item.href), {
		"aria-current": active ? "page" : undefined,
		className: cn(
			"flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
			active ? "border-border bg-card text-foreground shadow-xs" : "border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
		),
		children: (
			<>
				{item.icon === undefined ? null : (
					<span aria-hidden="true" className={cn("flex size-5 shrink-0 items-center justify-center [&_svg]:size-[1.1rem]", active ? "text-primary" : "text-muted-foreground")}>
						{item.icon}
					</span>
				)}
				<span className="min-w-0 flex-1 truncate">{item.label}</span>
				{badge > 0 ? (
					<span
						className={cn(
							"flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs leading-5 font-semibold tabular-nums",
							active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
						)}>
						{String(badge)}
					</span>
				) : null}
			</>
		),
	});
}

export interface SettingsSectionHeaderProps {
	readonly title: string;
	readonly description: string;
	/** The section's main action (e.g. "Invite teammate"). */
	readonly action?: React.ReactNode;
}

/** The heading of one settings section: what it is, and its main action on the right. */
export function SettingsSectionHeader({ title, description, action }: SettingsSectionHeaderProps): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-start justify-between gap-4">
			<div className="min-w-0 space-y-1">
				<h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
				<p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
			</div>
			{action === undefined ? null : <div className="flex flex-wrap items-center gap-2">{action}</div>}
		</div>
	);
}

export interface SettingsSectionHeaderSkeletonProps {
	/** Draw the section's main action on the right, as the loaded header will. Default false. */
	readonly withAction?: boolean;
}

/**
 * `SettingsSectionHeader`'s silhouette — the `text-xl` heading, its description and (optionally) the action — so a
 * section's loading state takes exactly the space its header will, inside the settings page that stays put.
 */
export function SettingsSectionHeaderSkeleton({ withAction = false }: SettingsSectionHeaderSkeletonProps): React.JSX.Element {
	return (
		<div data-slot="settings-section-header-skeleton" className="flex flex-wrap items-start justify-between gap-4">
			<div className="flex min-w-0 flex-col gap-2">
				<Skeleton className="h-6 w-48 max-w-full" />
				<Skeleton variant="text" className="h-4 w-80 max-w-full" />
			</div>
			{withAction ? (
				<div data-slot="settings-section-action-skeleton">
					<Skeleton className="h-9 w-36" />
				</div>
			) : null}
		</div>
	);
}
