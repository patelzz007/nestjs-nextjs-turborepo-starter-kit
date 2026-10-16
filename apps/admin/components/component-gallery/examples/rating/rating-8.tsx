"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

interface EmojiOption {
	readonly value: number;
	readonly emoji: string;
	readonly label: string;
}

const emojis: readonly EmojiOption[] = [
	{ value: 1, emoji: "😞", label: "Terrible" },
	{ value: 2, emoji: "😕", label: "Bad" },
	{ value: 3, emoji: "😐", label: "Okay" },
	{ value: 4, emoji: "😊", label: "Good" },
	{ value: 5, emoji: "🤩", label: "Amazing" },
];

interface EmojiButtonProps {
	readonly option: EmojiOption;
	readonly isSelected: boolean;
	readonly onSelect: (value: number) => void;
}

function EmojiButton({ option, isSelected, onSelect }: EmojiButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(option.value);
	}, [onSelect, option.value]);

	return (
		<button
			type="button"
			aria-label={option.label}
			aria-pressed={isSelected}
			onClick={handleClick}
			className={cn(
				"flex size-10 items-center justify-center rounded-lg border-2 text-2xl transition-all",
				isSelected ? "scale-110 border-border bg-muted" : "border-transparent hover:bg-muted",
			)}>
			{option.emoji}
		</button>
	);
}

export function Rating8Example(): React.JSX.Element {
	const [selected, setSelected] = React.useState<number | null>(null);
	const selectedOption = emojis.find((option: EmojiOption): boolean => option.value === selected);

	return (
		<div className="mx-auto flex w-full max-w-xs flex-col items-center gap-3">
			<p className="text-sm font-medium">How was your experience?</p>
			<div className="flex gap-2">
				{emojis.map((option: EmojiOption): React.JSX.Element => (
					<EmojiButton key={option.value} option={option} isSelected={selected === option.value} onSelect={setSelected} />
				))}
			</div>
			{selectedOption ? <p className="text-sm text-muted-foreground">{selectedOption.label}</p> : null}
		</div>
	);
}
