"use client";

import * as React from "react";
import {
	BellIcon,
	ChartBarIcon,
	ChevronRightIcon,
	CreditCardIcon,
	FileTextIcon,
	LayoutDashboardIcon,
	MessageSquareIcon,
	SettingsIcon,
	ShieldIcon,
	UserIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Card, CardContent } from "@workspace/ui/components/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { Item, ItemMedia, ItemTitle } from "@workspace/ui/components/item";

interface NavItem {
	readonly id: string;
	readonly name: string;
	readonly icon: React.ReactElement;
	readonly items?: readonly NavItem[];
}

interface NavMenuItemProps {
	readonly item: NavItem;
	readonly level?: number;
	readonly selectedId: string | null;
	readonly onSelect: (id: string) => void;
}

/** Each menu level indents by this much, on top of the row's base padding (px). */
const LEVEL_INDENT_PX = 12;
const BASE_PADDING_PX = 8;

const navItems: readonly NavItem[] = [
	{
		id: "dashboard",
		name: "Dashboard",
		icon: <LayoutDashboardIcon />,
		items: [
			{
				id: "analytics",
				name: "Analytics",
				icon: <ChartBarIcon />,
				items: [
					{
						id: "real-time",
						name: "Real-time",
						icon: <FileTextIcon aria-hidden="true" />,
					},
					{
						id: "historical",
						name: "Historical",
						icon: <FileTextIcon aria-hidden="true" />,
					},
				],
			},
			{
				id: "reports",
				name: "Reports",
				icon: <MessageSquareIcon aria-hidden="true" />,
			},
		],
	},
	{
		id: "team",
		name: "Team",
		icon: <UserIcon aria-hidden="true" />,
		items: [
			{
				id: "members",
				name: "Members",
				icon: <UserIcon aria-hidden="true" />,
			},
			{
				id: "permissions",
				name: "Permissions",
				icon: <ShieldIcon aria-hidden="true" />,
			},
		],
	},
	{
		id: "billing",
		name: "Billing",
		icon: <CreditCardIcon aria-hidden="true" />,
	},
	{
		id: "settings",
		name: "Settings",
		icon: <SettingsIcon aria-hidden="true" />,
	},
	{
		id: "notifications",
		name: "Notifications",
		icon: <BellIcon aria-hidden="true" />,
	},
];

function NavMenuItem({ item, level = 0, selectedId, onSelect }: NavMenuItemProps): React.JSX.Element {
	const children = item.items ?? [];
	const isFolder = children.length > 0;
	const isSelected = selectedId === item.id;
	const rowStyle = useMemo((): React.CSSProperties => ({ paddingLeft: `${String(level * LEVEL_INDENT_PX + BASE_PADDING_PX)}px` }), [level]);
	const handleClick = useCallback((): void => {
		onSelect(item.id);
	}, [item.id, onSelect]);

	if (isFolder) {
		return (
			<Collapsible>
				<CollapsibleTrigger
					render={
						<Item
							render={<button type="button" />}
							size="xs"
							className="group/item cursor-pointer py-1.25 hover:bg-accent focus-visible:ring-inset aria-expanded:bg-accent"
							style={rowStyle}
						/>
					}>
					<ItemMedia variant="icon">
						<div className="size-3.5 text-muted-foreground group-hover/item:text-foreground">{item.icon}</div>
					</ItemMedia>
					<ItemTitle className="text-sm in-aria-expanded:font-semibold">{item.name}</ItemTitle>
					<ChevronRightIcon aria-hidden="true" className="ml-auto size-4 text-muted-foreground transition-transform in-aria-expanded:rotate-90" />
				</CollapsibleTrigger>
				<CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
					<div className="flex flex-col gap-0.5 pt-0.5">
						{children.map((child: NavItem): React.JSX.Element => (
							<NavMenuItem key={child.id} item={child} level={level + 1} selectedId={selectedId} onSelect={onSelect} />
						))}
					</div>
				</CollapsibleContent>
			</Collapsible>
		);
	}

	return (
		<Item
			size="xs"
			className="group/item cursor-pointer py-1.25 hover:bg-accent data-[active=true]:bg-accent data-[active=true]:text-foreground"
			data-active={isSelected}
			style={rowStyle}
			onClick={handleClick}>
			<ItemMedia variant="icon">
				<div className="size-3.5 text-muted-foreground group-hover/item:text-foreground group-data-[active=true]/item:text-foreground">{item.icon}</div>
			</ItemMedia>
			<ItemTitle className="text-sm">{item.name}</ItemTitle>
		</Item>
	);
}

export function Collapsible9Example(): React.JSX.Element {
	const [selectedId, setSelectedId] = useState<string | null>("real-time");

	return (
		<div className="min-h-64 w-full max-w-56">
			<Card className="p-0">
				<CardContent className="p-1">
					<div className="flex flex-col gap-0.5">
						{navItems.map((item) => (
							<NavMenuItem key={item.id} item={item} selectedId={selectedId} onSelect={setSelectedId} />
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
