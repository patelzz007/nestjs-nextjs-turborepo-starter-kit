"use client";

import * as React from "react";
import {
	ActivityIcon,
	BarChart3Icon,
	BoxesIcon,
	DatabaseIcon,
	GlobeIcon,
	InboxIcon,
	LayoutDashboardIcon,
	RocketIcon,
	SettingsIcon,
	ShieldCheckIcon,
	ZapIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import type { TooltipContent } from "@workspace/ui/components/tooltip";

import {
	SIDEBAR_EXAMPLE_FRAME_CLASS_NAME,
	SIDEBAR_EXAMPLE_PANEL_CLASS_NAME,
	SIDEBAR_EXAMPLE_STORAGE,
} from "@/components/component-gallery/examples/sidebar/sidebar-example-frame";

type TooltipProps = React.ComponentProps<typeof TooltipContent>;

interface RailItem {
	readonly id: string;
	readonly label: string;
	readonly icon: ReactNode;
	/** The tooltip that names the item once the rail collapses to icons. */
	readonly tooltip: TooltipProps;
	readonly badge?: number;
	readonly isActive?: boolean;
}

interface Monitor {
	readonly id: string;
	readonly label: string;
	readonly value: string;
	readonly icon: ReactNode;
}

// Each icon is a JSX node whose per-library names are STATIC literals. That is
// the shape `shadcn add` rewrites when it swaps the icon package, so an
// interpolated value would leave it nothing to rewrite.
const NAV: readonly RailItem[] = [
	{
		id: "overview",
		label: "Overview",
		tooltip: { children: "Overview" },
		icon: <LayoutDashboardIcon aria-hidden="true" />,
	},
	{
		id: "inbox",
		label: "Inbox",
		tooltip: { children: "Inbox" },
		badge: 12,
		icon: <InboxIcon aria-hidden="true" />,
	},
	{
		id: "deployments",
		label: "Deployments",
		tooltip: { children: "Deployments" },
		isActive: true,
		icon: <RocketIcon aria-hidden="true" />,
	},
	{
		id: "monitoring",
		label: "Monitoring",
		tooltip: { children: "Monitoring" },
		icon: <ActivityIcon aria-hidden="true" />,
	},
	{
		id: "analytics",
		label: "Analytics",
		tooltip: { children: "Analytics" },
		icon: <BarChart3Icon aria-hidden="true" />,
	},
	{
		id: "audit",
		label: "Audit log",
		tooltip: { children: "Audit log" },
		icon: <ShieldCheckIcon aria-hidden="true" />,
	},
	{
		id: "settings",
		label: "Settings",
		tooltip: { children: "Settings" },
		icon: <SettingsIcon aria-hidden="true" />,
	},
];

const MONITORS: readonly Monitor[] = [
	{
		id: "edge",
		label: "Edge network",
		value: "99.99%",
		icon: <GlobeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
	},
	{
		id: "webhooks",
		label: "Webhook delivery",
		value: "42ms p95",
		icon: <ZapIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
	},
	{
		id: "jobs",
		label: "Background jobs",
		value: "12 queued",
		icon: <DatabaseIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
	},
];

// The rail itself. Two things the primitive already handles, so nothing here
// has to: the button clips its own label at a 3rem width instead of removing
// it, so the accessible name survives the collapse, and SidebarMenuBadge
// carries `group-data-[collapsible=icon]:hidden`, so counts disappear with the
// labels rather than stacking on top of an icon.
//
// `tooltip` is the other half of that bargain. The primitive renders it with
// `hidden` until `state` is collapsed, so it costs nothing while the labels
// are on screen and becomes the only name a mouse user sees once they are not.
function RailNav(): React.JSX.Element {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Platform</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					{NAV.map((item) => (
						<SidebarMenuItem key={item.id}>
							<SidebarMenuButton isActive={item.isActive ?? false} tooltip={item.tooltip}>
								{item.icon}
								<span>{item.label}</span>
							</SidebarMenuButton>
							{item.badge === undefined ? null : <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}

// The product mark: a neutral icon tile on the sidebar's primary colour, so it
// recolours with the panel and needs no asset.
function BrandMark(): React.JSX.Element {
	return (
		<span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
			<BoxesIcon className="size-4" />
		</span>
	);
}

const BRAND_TOOLTIP: TooltipProps = { children: "Northwind Labs" };

const ACCOUNT_TOOLTIP: TooltipProps = { children: "Nadia Rahman" };

// The mark is BrandMark, the same inline SVG the other sidebar examples carry,
// scaled at the call site from its 24px default to the 32px tile sidebar-08
// gives a `size="lg"` header row.
//
// `size="lg"` is what makes that tile survive the collapse: every menu button
// is forced to `size-8` on the rail, and large is the one size that zeroes the
// padding there in all eight styles, so a 32px tile fills it exactly.
// `group-data-[collapsible=icon]:sr-only` on the name block is the other half.
// It leaves the flex line, and takes the 8px gap with it, while keeping the
// button's accessible name, so the tile is the only child left and sits on the
// rail's axis with nothing needed to centre it.
function BrandButton(): React.JSX.Element {
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton size="lg" tooltip={BRAND_TOOLTIP}>
					<BrandMark />
					<span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:sr-only">
						<span className="truncate text-sm font-medium">Northwind Labs</span>
						<span className="truncate text-xs text-sidebar-foreground/70">Production</span>
					</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

// The same collapsed-rail treatment as the brand mark, with the avatar sized
// to match it. Avatar's default is 32px, which is both what sidebar-07's
// footer row uses and what fills the collapsed button edge to edge.
function AccountButton(): React.JSX.Element {
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton size="lg" tooltip={ACCOUNT_TOOLTIP}>
					<Avatar>
						<AvatarFallback>NR</AvatarFallback>
					</Avatar>
					<span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:sr-only">
						<span className="truncate text-sm font-medium">Nadia Rahman</span>
						<span className="truncate text-xs text-sidebar-foreground/70">Owner</span>
					</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

// A rail that collapses to icons, and the two controls that drive it.
//
// The collapsed width is the provider's own `--sidebar-width-icon` (3rem), and
// the open state lives in SidebarProvider, so nothing here mirrors it: both
// controls call the same context.
//
// SidebarTrigger sits in the inset rather than in the panel because it is the
// only control that survives both branches. shadcn's Sidebar renders its
// desktop rail behind `hidden md:block` and swaps to a Sheet under 768px, and
// SidebarRail is `sm:flex` against that desktop wrapper, so on a narrow frame
// the trigger in the header is what opens the navigation at all.
//
// `min-h-0` beside the height is load-bearing. SidebarProvider ships
// `min-h-svh`, and tailwind-merge only drops it when another `min-h-*` arrives
// with it, so without the pair this shell is viewport tall wherever it lands.
//
// `absolute h-full` on the Sidebar is the other half of that. The desktop
// branch's panel ships `fixed inset-y-0 h-svh`, and a fixed box ignores both
// the height above and the ancestor's overflow, so it would size and position
// against the VIEWPORT and paint down the page beside a 468px shell. The
// className lands on that container and tailwind-merge swaps both groups, and
// `relative` on the provider is what the panel then measures itself against.
// The mobile branch is untouched: it renders a Sheet and never forwards
// className to it.
export function Sidebar2Example(): React.JSX.Element {
	return (
		<SidebarProvider storage={SIDEBAR_EXAMPLE_STORAGE} className={SIDEBAR_EXAMPLE_FRAME_CLASS_NAME}>
			<Sidebar collapsible="icon" className={SIDEBAR_EXAMPLE_PANEL_CLASS_NAME}>
				<SidebarHeader>
					<BrandButton />
				</SidebarHeader>

				<SidebarContent role="navigation" aria-label="Primary">
					<RailNav />
				</SidebarContent>

				<SidebarFooter>
					<AccountButton />
				</SidebarFooter>

				{/*
          SidebarRail ships its own `tabIndex={-1}` and `aria-label`, so the
          grab strip on the panel edge is a mouse affordance and the trigger in
          the inset header is the keyboard path. Two tab stops for one toggle
          would only slow a keyboard user down.
        */}
				<SidebarRail />
			</Sidebar>

			<SidebarInset className="min-w-0 overflow-hidden">
				<header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
					<SidebarTrigger />
					<h2 className="truncate text-sm font-medium">Deployments</h2>
					<Button variant="outline" size="sm" className="ml-auto">
						New deploy
					</Button>
				</header>

				<div className="min-w-0 flex-1 overflow-auto p-4">
					<p className="max-w-prose text-sm text-muted-foreground">
						Every deploy runs against the edge network first. Collapse the rail with the panel button or the strip on its edge, and the labels give way to tooltips.
					</p>

					<dl className="mt-4 flex flex-col gap-3">
						{MONITORS.map((monitor) => (
							<div key={monitor.id} className="flex items-center gap-2 text-sm">
								<dt className="flex min-w-0 flex-1 items-center gap-2">
									{monitor.icon}
									<span className="truncate">{monitor.label}</span>
								</dt>
								<dd className="shrink-0 tabular-nums">{monitor.value}</dd>
							</div>
						))}
					</dl>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
