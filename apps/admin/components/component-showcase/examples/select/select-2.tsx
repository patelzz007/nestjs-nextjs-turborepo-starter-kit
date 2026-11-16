"use client";

import type * as React from "react";
import { ActivityIcon, LayoutDashboardIcon, SettingsIcon, ShieldIcon } from "lucide-react";

import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Item {
	readonly label: string;
	readonly value: string;
	readonly icon: React.JSX.Element;
}

const items: readonly Item[] = [
	{
		label: "Dashboard",
		value: "dashboard",
		icon: <LayoutDashboardIcon className="size-4 text-muted-foreground" />,
	},
	{
		label: "Activity",
		value: "activity",
		icon: <ActivityIcon className="size-4 text-muted-foreground" />,
	},
	{
		label: "Security",
		value: "security",
		icon: <ShieldIcon className="size-4 text-muted-foreground" />,
	},
	{
		label: "Settings",
		value: "settings",
		icon: <SettingsIcon className="size-4 text-muted-foreground" />,
	},
];

function formatItem(value: string): React.ReactNode {
	const item = items.find((option) => option.value === value);
	if (item === undefined) {
		return value;
	}
	return (
		<span className="flex items-center gap-2">
			{item.icon}
			<span>{item.label}</span>
		</span>
	);
}

export function Select2Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select items={items}>
				<SelectTrigger className="w-[200px]">
					<SelectValue placeholder="Select an option" formatValue={formatItem} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{items.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.icon}
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
