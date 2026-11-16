"use client";

// The sidebars the Do / Don't pairs show: a fixed panel of grouped links (headings and a search optional), and an
// icon rail with or without the button that opens it again.

import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { SIDEBAR_EXAMPLE_FRAME_CLASS_NAME, SIDEBAR_EXAMPLE_STORAGE } from "@/components/component-showcase/examples/sidebar/sidebar-example-frame";

/** A group of links, under a heading or none. */
export interface GuidelineSidebarGroup {
	readonly label?: string | undefined;
	readonly items: readonly string[];
}

export interface GuidelineSidebarProps {
	readonly groups: readonly GuidelineSidebarGroup[];
	/** A search field above the groups. */
	readonly searchable: boolean;
}

/** A fixed panel (`collapsible="none"`): the same at every width. */
export function GuidelineSidebar({ groups, searchable }: GuidelineSidebarProps): React.JSX.Element {
	return (
		<SidebarProvider storage={SIDEBAR_EXAMPLE_STORAGE} className={SIDEBAR_EXAMPLE_FRAME_CLASS_NAME}>
			<Sidebar collapsible="none">
				{searchable ? (
					<SidebarHeader>
						<SidebarInput aria-label="Search pages" placeholder="Search pages" />
					</SidebarHeader>
				) : null}
				<SidebarContent role="navigation" aria-label="Workspace">
					{groups.map((group: GuidelineSidebarGroup, position: number): React.JSX.Element => (
						<SidebarGroup key={group.label ?? `group-${String(position)}`}>
							{group.label === undefined ? null : <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
							<SidebarGroupContent>
								<SidebarMenu>
									{group.items.map((item: string): React.JSX.Element => (
										<SidebarMenuItem key={item}>
											<SidebarMenuButton>{item}</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					))}
				</SidebarContent>
			</Sidebar>
		</SidebarProvider>
	);
}

/** One link of the icon rail. */
export interface GuidelineRailItem {
	readonly label: string;
	readonly icon: LucideIcon;
}

export interface GuidelineRailProps {
	readonly items: readonly GuidelineRailItem[];
	/** The button that opens the rail into the full sidebar again. */
	readonly withTrigger: boolean;
}

/** The tooltip beside a rail icon: its label. */
function tooltipOf(label: string): NonNullable<React.ComponentProps<typeof SidebarMenuButton>["tooltip"]> {
	return { children: label };
}

/** A sidebar collapsed to icons (`collapsible="icon"`, closed). */
export function GuidelineRail({ items, withTrigger }: GuidelineRailProps): React.JSX.Element {
	return (
		<SidebarProvider storage={SIDEBAR_EXAMPLE_STORAGE} defaultOpen={false} className={SIDEBAR_EXAMPLE_FRAME_CLASS_NAME}>
			<Sidebar collapsible="icon" className="absolute h-full">
				{withTrigger ? (
					<SidebarHeader>
						<SidebarTrigger />
					</SidebarHeader>
				) : null}
				<SidebarContent role="navigation" aria-label="Workspace">
					<SidebarGroup>
						<SidebarMenu>
							{items.map(({ label, icon: Glyph }: GuidelineRailItem): React.JSX.Element => (
								<SidebarMenuItem key={label}>
									<SidebarMenuButton tooltip={tooltipOf(label)}>
										<Glyph aria-hidden="true" />
										<span>{label}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
		</SidebarProvider>
	);
}
