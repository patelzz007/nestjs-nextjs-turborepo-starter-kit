"use client";

import type * as React from "react";
import { BarChart2Icon, CircleHelpIcon, LayoutDashboardIcon, SettingsIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

interface NavItem {
	readonly id: string;
	readonly label: string;
	readonly icon: React.JSX.Element;
}

const navItems: readonly NavItem[] = [
	{
		id: "dashboard",
		label: "Dashboard",
		icon: <LayoutDashboardIcon aria-hidden="true" />,
	},
	{
		id: "analytics",
		label: "Analytics",
		icon: <BarChart2Icon aria-hidden="true" />,
	},
	{
		id: "settings",
		label: "Settings",
		icon: <SettingsIcon aria-hidden="true" />,
	},
	{
		id: "help",
		label: "Help",
		icon: <CircleHelpIcon aria-hidden="true" />,
	},
];

export function ButtonGroup49Example(): React.JSX.Element {
	const [active, setActive] = useState<string>("dashboard");

	const handleSelect = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { id } = event.currentTarget.dataset;
		if (id !== undefined) {
			setActive(id);
		}
	}, []);

	return (
		<ButtonGroup orientation="vertical">
			{navItems.map((item) => (
				<Button
					key={item.id}
					variant="outline"
					className={cn("justify-start", active === item.id ? "bg-muted" : "")}
					data-id={item.id}
					aria-current={active === item.id ? "page" : undefined}
					onClick={handleSelect}>
					{item.icon}
					{item.label}
				</Button>
			))}
		</ButtonGroup>
	);
}
