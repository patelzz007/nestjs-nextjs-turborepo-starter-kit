"use client";

import type * as React from "react";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

interface Stance {
	readonly id: string;
	readonly label: string;
	readonly icon: React.JSX.Element;
}

const stances: readonly Stance[] = [
	{
		id: "buy",
		label: "Buy",
		icon: <TrendingUpIcon aria-hidden="true" />,
	},
	{
		id: "hold",
		label: "Hold",
		icon: <MinusIcon aria-hidden="true" />,
	},
	{
		id: "sell",
		label: "Sell",
		icon: <TrendingDownIcon aria-hidden="true" />,
	},
];

export function ButtonGroup43Example(): React.JSX.Element {
	const [active, setActive] = useState<string | null>(null);

	/** Selects the clicked stance, or clears it when it was already active. */
	const handleToggle = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { id } = event.currentTarget.dataset;
		if (id !== undefined) {
			setActive((current) => (current === id ? null : id));
		}
	}, []);

	return (
		<ButtonGroup>
			{stances.map((stance) => (
				<Button key={stance.id} variant={active === stance.id ? "default" : "outline"} data-id={stance.id} aria-pressed={active === stance.id} onClick={handleToggle}>
					{stance.icon}
					{stance.label}
				</Button>
			))}
		</ButtonGroup>
	);
}
