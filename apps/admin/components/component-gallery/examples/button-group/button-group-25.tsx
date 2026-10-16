"use client";

import type * as React from "react";
import { useCallback, useState } from "react";

import { cn } from "@workspace/ui/lib/core/utils";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

/** The Net Promoter scale: 1 (not likely) to 10 (very likely). */
const MAX_SCORE = 10;
const SCORES: readonly number[] = Array.from({ length: MAX_SCORE }, (_, index): number => index + 1);

interface ScoreButtonProps {
	readonly score: number;
	readonly selected: boolean;
	readonly onSelect: (score: number) => void;
}

function ScoreButton({ score, selected, onSelect }: ScoreButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onSelect(score);
	}, [onSelect, score]);

	return (
		<Button
			variant="outline"
			size="icon-sm"
			aria-pressed={selected}
			onClick={handleClick}
			className={cn(selected && "border-primary bg-primary text-primary-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground")}>
			{score}
		</Button>
	);
}

export function ButtonGroup25Example(): React.JSX.Element {
	const [rating, setRating] = useState<number | null>(null);

	const handleSelect = useCallback((score: number): void => {
		setRating(score);
	}, []);

	return (
		<div className="space-y-3">
			<p className="text-sm font-medium">How likely are you to recommend us?</p>
			<ButtonGroup>
				{SCORES.map((score) => (
					<ScoreButton key={score} score={score} selected={rating === score} onSelect={handleSelect} />
				))}
			</ButtonGroup>
			<div className="flex justify-between text-xs text-muted-foreground">
				<span>Not likely</span>
				<span>Very likely</span>
			</div>
		</div>
	);
}
