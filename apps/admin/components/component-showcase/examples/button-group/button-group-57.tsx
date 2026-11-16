"use client";

import type * as React from "react";
import { ChevronDownIcon, MessageSquareIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

interface Mode {
	readonly id: string;
	readonly label: string;
	readonly icon: React.JSX.Element;
}

const modes: readonly Mode[] = [
	{
		id: "assist",
		label: "Assist",
		icon: <MessageSquareIcon className="size-3.5 opacity-60" aria-hidden="true" />,
	},
	{
		id: "review",
		label: "Review",
		icon: <ShieldCheckIcon className="size-3.5 opacity-60" aria-hidden="true" />,
	},
	{
		id: "auto",
		label: "Auto",
		icon: <ZapIcon className="size-3.5 opacity-60" aria-hidden="true" />,
	},
];

const limits: readonly string[] = ["2k credits", "10k credits", "Unlimited"];

const DEFAULT_MODE = "review";
const DEFAULT_LIMIT = "10k credits";

const LIMIT_TRIGGER = <Button variant="outline" size="sm" className="gap-1.5 text-xs" aria-label="Select credit cap" />;

interface ChoiceMenuItemProps {
	readonly choice: string;
	readonly onChoose: (choice: string) => void;
	readonly children: React.ReactNode;
}

/** A menu row that reports its own choice, so the menu binds one stable handler. */
function ChoiceMenuItem({ choice, onChoose, children }: ChoiceMenuItemProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onChoose(choice);
	}, [choice, onChoose]);

	return <DropdownMenuItem onClick={handleClick}>{children}</DropdownMenuItem>;
}

export function ButtonGroup57Example(): React.JSX.Element {
	const [active, setActive] = useState<string>(DEFAULT_MODE);
	const [limit, setLimit] = useState<string>(DEFAULT_LIMIT);

	const handleMode = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
		const { id } = event.currentTarget.dataset;
		if (id !== undefined) {
			setActive(id);
		}
	}, []);
	const handleLimit = useCallback((choice: string): void => {
		setLimit(choice);
	}, []);

	return (
		<ButtonGroup>
			{modes.map((mode) => (
				<Button
					key={mode.id}
					variant="outline"
					size="sm"
					className={cn(active === mode.id && "bg-muted")}
					data-id={mode.id}
					aria-pressed={active === mode.id}
					onClick={handleMode}>
					{mode.icon}
					{mode.label}
				</Button>
			))}
			<ButtonGroupSeparator />
			<DropdownMenu>
				<DropdownMenuTrigger render={LIMIT_TRIGGER}>
					{limit}
					<ChevronDownIcon className="size-3 opacity-60" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-32">
					<DropdownMenuGroup>
						{limits.map((item) => (
							<ChoiceMenuItem key={item} choice={item} onChoose={handleLimit}>
								{item}
							</ChoiceMenuItem>
						))}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</ButtonGroup>
	);
}
