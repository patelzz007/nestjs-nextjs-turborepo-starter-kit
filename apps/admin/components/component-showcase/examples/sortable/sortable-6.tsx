"use client";

import * as React from "react";
import { BarChart3Icon, CalendarIcon, FolderIcon, GripVerticalIcon, InboxIcon, LayoutDashboardIcon, SettingsIcon } from "lucide-react";
import { ReactNode, useState } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui/components/sortable";

interface NavItem {
	id: string;
	label: string;
	icon: ReactNode;
	count?: number;
}

const defaultItems: NavItem[] = [
	{
		id: "1",
		label: "Dashboard",
		icon: <LayoutDashboardIcon className="size-4 text-muted-foreground" />,
	},
	{
		id: "2",
		label: "Inbox",
		icon: <InboxIcon className="size-4 text-muted-foreground" />,
		count: 5,
	},
	{
		id: "3",
		label: "Projects",
		icon: <FolderIcon className="size-4 text-muted-foreground" />,
		count: 12,
	},
	{
		id: "4",
		label: "Calendar",
		icon: <CalendarIcon className="size-4 text-muted-foreground" />,
	},
	{
		id: "5",
		label: "Analytics",
		icon: <BarChart3Icon className="size-4 text-muted-foreground" />,
	},
	{
		id: "6",
		label: "Settings",
		icon: <SettingsIcon className="size-4 text-muted-foreground" />,
	},
];

function getItemValue(item: NavItem): string {
	return item.id;
}

export function Sortable6Example(): React.JSX.Element {
	const [items, setItems] = useState<NavItem[]>(defaultItems);

	return (
		<div className="mx-auto w-full max-w-xs">
			<Frame spacing="xs">
				<FrameHeader>
					<FrameTitle>Navigation</FrameTitle>
				</FrameHeader>
				<FramePanel className="p-2!">
					<Sortable value={items} onValueChange={setItems} getItemValue={getItemValue} strategy="vertical" className="space-y-0.5">
						{items.map((item) => (
							<SortableItem key={item.id} value={item.id}>
								<div className="flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
									<SortableItemHandle className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground [div:hover>&]:opacity-100">
										<GripVerticalIcon className="size-3.5" />
									</SortableItemHandle>
									{item.icon}
									<span className="flex-1 text-sm">{item.label}</span>
									{item.count ? (
										<Badge variant="outline" size="sm" className="rounded-full">
											{item.count}
										</Badge>
									) : null}
								</div>
							</SortableItem>
						))}
					</Sortable>
				</FramePanel>
			</Frame>
		</div>
	);
}
