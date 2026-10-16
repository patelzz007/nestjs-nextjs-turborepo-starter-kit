"use client";

import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import { cn } from "@workspace/ui/lib/core/utils";
import { MoreHorizontalIcon, TriangleAlertIcon } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

type PriorityTone = "none" | "low" | "medium" | "high" | "urgent";

interface PriorityOption {
	readonly value: string;
	readonly label: string;
	readonly tone: PriorityTone;
}

/** The priority set when the example first renders. */
const NO_PRIORITY: PriorityOption = { value: "none", label: "No Priority", tone: "none" };

const PRIORITY_OPTIONS: readonly PriorityOption[] = [
	NO_PRIORITY,
	{ value: "low", label: "Low", tone: "low" },
	{ value: "medium", label: "Medium", tone: "medium" },
	{ value: "high", label: "High", tone: "high" },
	{ value: "urgent", label: "Urgent", tone: "urgent" },
];

const TRIGGER_BUTTON = <Button type="button" variant="outline" className="w-full justify-between font-normal" />;

function priorityLabel(priority: PriorityOption): string {
	return priority.label;
}

interface IconProps {
	readonly className?: string;
}

function LowPriorityIcon({ className }: IconProps): React.JSX.Element {
	return (
		<svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={cn("size-4 shrink-0", className)}>
			<rect x="3" y="9" width="2.5" height="4" rx="1" fill="currentColor" />
			<rect x="7" y="6" width="2.5" height="7" rx="1" fill="currentColor" opacity="0.28" />
			<rect x="11" y="3" width="2.5" height="10" rx="1" fill="currentColor" opacity="0.28" />
		</svg>
	);
}

function MediumPriorityIcon({ className }: IconProps): React.JSX.Element {
	return (
		<svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={cn("size-4 shrink-0", className)}>
			<rect x="3" y="9" width="2.5" height="4" rx="1" fill="currentColor" />
			<rect x="7" y="6" width="2.5" height="7" rx="1" fill="currentColor" />
			<rect x="11" y="3" width="2.5" height="10" rx="1" fill="currentColor" opacity="0.28" />
		</svg>
	);
}

function HighPriorityIcon({ className }: IconProps): React.JSX.Element {
	return (
		<svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className={cn("size-4 shrink-0", className)}>
			<rect x="3" y="9" width="2.5" height="4" rx="1" fill="currentColor" />
			<rect x="7" y="6" width="2.5" height="7" rx="1" fill="currentColor" />
			<rect x="11" y="3" width="2.5" height="10" rx="1" fill="currentColor" />
		</svg>
	);
}

interface PriorityGlyphProps {
	readonly tone: PriorityTone;
	readonly className?: string;
}

function PriorityGlyph({ tone, className }: PriorityGlyphProps): React.JSX.Element {
	switch (tone) {
		case "none":
			return <MoreHorizontalIcon className={cn("size-4 shrink-0 text-muted-foreground! **:text-muted-foreground!", className)} />;
		case "low":
			return <LowPriorityIcon className={cn("text-foreground! **:text-foreground!", className)} />;
		case "medium":
			return <MediumPriorityIcon className={cn("text-foreground! **:text-foreground!", className)} />;
		case "high":
			return <HighPriorityIcon className={cn("text-foreground! **:text-foreground!", className)} />;
		case "urgent":
			return <TriangleAlertIcon className={cn("size-4 shrink-0 text-warning! **:text-warning!", className)} />;
	}
}

interface PriorityLabelProps {
	readonly priority: PriorityOption;
	readonly className?: string;
}

function PriorityLabel({ priority, className }: PriorityLabelProps): React.JSX.Element {
	const isUrgent = priority.tone === "urgent";

	return (
		<span className={cn("flex min-w-0 items-center gap-2", isUrgent ? "text-warning!" : "text-foreground!", className)}>
			<PriorityGlyph tone={priority.tone} />
			<span className={cn("truncate", isUrgent ? "text-warning!" : "text-foreground!")}>{priority.label}</span>
		</span>
	);
}

function renderPriorityItem(priority: PriorityOption): React.JSX.Element {
	return (
		<ComboboxItem key={priority.value} value={priority}>
			<PriorityLabel priority={priority} />
		</ComboboxItem>
	);
}

export function Combobox22Example(): React.JSX.Element {
	const [priority, setPriority] = useState<PriorityOption | null>(NO_PRIORITY);

	return (
		<Field className="max-w-xs">
			<Combobox items={PRIORITY_OPTIONS} value={priority} onValueChange={setPriority} itemToStringValue={priorityLabel} autoHighlight>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					{priority === null ? <span className="text-muted-foreground">Set priority</span> : <PriorityLabel priority={priority} />}
				</ComboboxTrigger>

				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxInput showTrigger={false} placeholder="Change priority" className="mb-1" />
					<ComboboxEmpty text="No priorities found." />
					<ComboboxList>
						<ComboboxCollection>{renderPriorityItem}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
