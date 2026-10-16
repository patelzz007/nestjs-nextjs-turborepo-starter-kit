"use client";

import type * as React from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsUpDownIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

const stages: readonly string[] = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed Won"];

/** The pipeline opens on "Proposal", the third stage. */
const INITIAL_STAGE_INDEX = 2;
const FIRST_STAGE_INDEX = 0;
const LAST_STAGE_INDEX = stages.length - 1;

const icons = {
	prev: <ChevronLeftIcon aria-hidden="true" />,
	next: <ChevronRightIcon aria-hidden="true" />,
	chevronsUpDown: <ChevronsUpDownIcon aria-hidden="true" className="size-3.5 shrink-0 opacity-50" />,
	check: <CheckIcon aria-hidden="true" className="ml-auto size-3.5 text-primary" />,
};

interface StageMenuItemProps {
	readonly stage: string;
	readonly index: number;
	readonly selected: boolean;
	readonly onSelect: (index: number) => void;
}

function StageMenuItem({ stage, index, selected, onSelect }: StageMenuItemProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onSelect(index);
	}, [index, onSelect]);

	return (
		<DropdownMenuItem onClick={handleClick}>
			{stage}
			{selected ? icons.check : null}
		</DropdownMenuItem>
	);
}

export function ButtonGroup44Example(): React.JSX.Element {
	const [stageIndex, setStageIndex] = useState<number>(INITIAL_STAGE_INDEX);

	const handlePrevious = useCallback((): void => {
		setStageIndex((index) => Math.max(index - 1, FIRST_STAGE_INDEX));
	}, []);
	const handleNext = useCallback((): void => {
		setStageIndex((index) => Math.min(index + 1, LAST_STAGE_INDEX));
	}, []);
	const handleSelect = useCallback((index: number): void => {
		setStageIndex(index);
	}, []);

	return (
		<ButtonGroup>
			<Button variant="outline" size="icon" aria-label="Previous stage" disabled={stageIndex === FIRST_STAGE_INDEX} onClick={handlePrevious}>
				{icons.prev}
			</Button>

			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button variant="outline" className="min-w-36 justify-between">
							<span className="truncate">{stages.at(stageIndex)}</span>
							{icons.chevronsUpDown}
						</Button>
					}
				/>
				<DropdownMenuContent className="w-44">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Jump to stage</DropdownMenuLabel>
						{stages.map((stage, index) => (
							<StageMenuItem key={stage} stage={stage} index={index} selected={index === stageIndex} onSelect={handleSelect} />
						))}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>

			<Button variant="outline" size="icon" aria-label="Next stage" disabled={stageIndex === LAST_STAGE_INDEX} onClick={handleNext}>
				{icons.next}
			</Button>
		</ButtonGroup>
	);
}
