"use client";

import type * as React from "react";
import { BotIcon, ChevronDownIcon, RouteIcon, WaypointsIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

interface ViewItem {
	readonly id: string;
	readonly label: string;
	readonly icon: React.JSX.Element;
}

const items: readonly ViewItem[] = [
	{
		id: "Routes",
		label: "Routes",
		icon: <RouteIcon aria-hidden="true" className="size-3.5 opacity-60" />,
	},
	{
		id: "Paths",
		label: "Paths",
		icon: <WaypointsIcon aria-hidden="true" className="size-3.5 opacity-60" />,
	},
	{
		id: "Bot Name",
		label: "Bot Name",
		icon: <BotIcon aria-hidden="true" className="size-3.5 opacity-60" />,
	},
];

const MORE_TRIGGER = <Button variant="outline" size="icon" aria-label="More options" />;

export function ButtonGroup34Example(): React.JSX.Element {
	const [active, setActive] = useState<string>("Paths");

	const handleSelect = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { id } = event.currentTarget.dataset;
		if (id !== undefined) {
			setActive(id);
		}
	}, []);

	return (
		<ButtonGroup>
			{items.map((item) => (
				<Button
					key={item.id}
					variant="outline"
					className={cn(active === item.id ? "bg-muted" : "")}
					data-id={item.id}
					aria-pressed={active === item.id}
					onClick={handleSelect}>
					{item.icon}
					{item.label}
				</Button>
			))}
			<DropdownMenu>
				<DropdownMenuTrigger render={MORE_TRIGGER}>
					<ChevronDownIcon aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-40">
					<DropdownMenuItem>Filter by Group</DropdownMenuItem>
					<DropdownMenuItem>Sort by Name</DropdownMenuItem>
					<DropdownMenuItem>Export Data</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
