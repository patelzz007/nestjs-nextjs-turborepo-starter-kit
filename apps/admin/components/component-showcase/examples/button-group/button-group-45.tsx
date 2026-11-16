"use client";

import type * as React from "react";
import { Code2Icon, GlobeIcon, TestTube2Icon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface Environment {
	readonly id: string;
	readonly label: string;
	readonly tooltip: string;
	readonly icon: React.JSX.Element;
}

const environments: readonly Environment[] = [
	{
		id: "development",
		label: "Dev",
		tooltip: "Local development environment",
		icon: <Code2Icon aria-hidden="true" />,
	},
	{
		id: "staging",
		label: "Staging",
		tooltip: "Pre-production mirror",
		icon: <TestTube2Icon aria-hidden="true" />,
	},
	{
		id: "production",
		label: "Production",
		tooltip: "Live environment — affects real users",
		icon: <GlobeIcon aria-hidden="true" />,
	},
];

export function ButtonGroup45Example(): React.JSX.Element {
	const [active, setActive] = useState<string>("development");

	const handleSelect = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { id } = event.currentTarget.dataset;
		if (id !== undefined) {
			setActive(id);
		}
	}, []);

	return (
		<ButtonGroup>
			{environments.map((env) => (
				<Tooltip key={env.id}>
					<TooltipTrigger
						render={
							<Button variant="outline" className={cn(active === env.id ? "bg-muted" : "")} data-id={env.id} aria-pressed={active === env.id} onClick={handleSelect}>
								{env.icon}
								{env.label}
							</Button>
						}
					/>
					<TooltipContent>{env.tooltip}</TooltipContent>
				</Tooltip>
			))}
			{active === "production" ? (
				<ButtonGroupText className="bg-transparent">
					<div className="size-1.5 rounded-full bg-success" />
					<span>Live</span>
				</ButtonGroupText>
			) : null}
		</ButtonGroup>
	);
}
