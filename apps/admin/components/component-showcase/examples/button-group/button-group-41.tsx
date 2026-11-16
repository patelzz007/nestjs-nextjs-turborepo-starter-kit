"use client";

import type * as React from "react";
import { BrainIcon, FlaskConicalIcon, ZapIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Badge, type BadgeProps } from "@workspace/ui/components/badge";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface Model {
	readonly id: string;
	readonly label: string;
	readonly badge: string;
	readonly badgeVariant: BadgeProps["variant"];
	readonly tooltip: string;
	readonly icon: React.JSX.Element;
}

const models: readonly Model[] = [
	{
		id: "gpt4o",
		label: "GPT-4o",
		badge: "Fast",
		badgeVariant: "success-light",
		tooltip: "128k context, fastest response",
		icon: <ZapIcon aria-hidden="true" />,
	},
	{
		id: "claude",
		label: "Claude",
		badge: "Pro",
		badgeVariant: "info-light",
		tooltip: "200k context, best for analysis",
		icon: <BrainIcon aria-hidden="true" />,
	},
	{
		id: "gemini",
		label: "Gemini",
		badge: "Preview",
		badgeVariant: "warning-light",
		tooltip: "1M context, experimental",
		icon: <FlaskConicalIcon aria-hidden="true" />,
	},
];

export function ButtonGroup41Example(): React.JSX.Element {
	const [active, setActive] = useState<string>("claude");

	const handleSelect = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { id } = event.currentTarget.dataset;
		if (id !== undefined) {
			setActive(id);
		}
	}, []);

	return (
		<ButtonGroup>
			{models.map((model) => (
				<Tooltip key={model.id}>
					<TooltipTrigger
						render={
							<Button variant="outline" className={cn(active === model.id ? "bg-muted" : "")} data-id={model.id} aria-pressed={active === model.id} onClick={handleSelect}>
								{model.icon}
								{model.label}
								<Badge variant={model.badgeVariant} size="xs">
									{model.badge}
								</Badge>
							</Button>
						}
					/>
					<TooltipContent>{model.tooltip}</TooltipContent>
				</Tooltip>
			))}
		</ButtonGroup>
	);
}
