"use client";

import type * as React from "react";
import { ShieldAlertIcon, ShieldCheckIcon, TargetIcon, TrendingUpIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface OrderType {
	readonly id: string;
	readonly label: string;
	readonly tooltip: string;
	readonly icon: React.JSX.Element;
}

const orderTypes: readonly OrderType[] = [
	{
		id: "market",
		label: "Market",
		tooltip: "Execute immediately at best available price",
		icon: <TrendingUpIcon aria-hidden="true" />,
	},
	{
		id: "limit",
		label: "Limit",
		tooltip: "Execute only at your specified price or better",
		icon: <TargetIcon aria-hidden="true" />,
	},
	{
		id: "stop",
		label: "Stop",
		tooltip: "Trigger a market order at stop level",
		icon: <ShieldAlertIcon aria-hidden="true" />,
	},
	{
		id: "stop-limit",
		label: "Stop-Limit",
		tooltip: "Trigger a limit order at stop level",
		icon: <ShieldCheckIcon aria-hidden="true" />,
	},
];

export function ButtonGroup42Example(): React.JSX.Element {
	const [active, setActive] = useState<string>("market");

	const handleSelect = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { id } = event.currentTarget.dataset;
		if (id !== undefined) {
			setActive(id);
		}
	}, []);

	return (
		<ButtonGroup>
			{orderTypes.map((type) => (
				<Tooltip key={type.id}>
					<TooltipTrigger
						render={
							<Button variant="outline" className={cn(active === type.id ? "bg-muted" : "")} data-id={type.id} aria-pressed={active === type.id} onClick={handleSelect}>
								{type.icon}
								{type.label}
							</Button>
						}
					/>
					<TooltipContent className="max-w-52 text-center">{type.tooltip}</TooltipContent>
				</Tooltip>
			))}
		</ButtonGroup>
	);
}
