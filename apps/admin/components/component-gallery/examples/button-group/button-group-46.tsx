"use client";

import type * as React from "react";
import { CalendarDaysIcon, CalendarIcon, ClockIcon, SparklesIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

interface Interval {
	readonly id: string;
	readonly icon: React.JSX.Element;
}

const intervals: readonly Interval[] = [
	{
		id: "1m",
		icon: <ClockIcon aria-hidden="true" />,
	},
	{
		id: "5m",
		icon: <ClockIcon aria-hidden="true" />,
	},
	{
		id: "1H",
		icon: <ClockIcon aria-hidden="true" />,
	},
	{
		id: "1D",
		icon: <CalendarIcon aria-hidden="true" />,
	},
	{
		id: "1W",
		icon: <CalendarDaysIcon aria-hidden="true" />,
	},
	{
		id: "Auto",
		icon: <SparklesIcon aria-hidden="true" />,
	},
];

export function ButtonGroup46Example(): React.JSX.Element {
	const [active, setActive] = useState<string>("1H");

	const handleSelect = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { id } = event.currentTarget.dataset;
		if (id !== undefined) {
			setActive(id);
		}
	}, []);

	return (
		<ButtonGroup>
			{intervals.map((interval) => (
				<Button
					key={interval.id}
					variant="outline"
					size="sm"
					className={cn("h-7 gap-1.5 px-2.5 text-xs tabular-nums", active === interval.id ? "bg-muted" : "")}
					data-id={interval.id}
					aria-pressed={active === interval.id}
					onClick={handleSelect}>
					{interval.icon}
					{interval.id}
				</Button>
			))}
		</ButtonGroup>
	);
}
