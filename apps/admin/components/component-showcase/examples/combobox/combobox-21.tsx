"use client";

import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import { cn } from "@workspace/ui/lib/core/utils";
import { CircleCheckIcon, CircleDotIcon, CircleIcon, CircleXIcon, PauseCircleIcon } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

type StatusTone = "backlog" | "planned" | "inProgress" | "paused" | "completed" | "cancelled";

interface StatusOption {
	readonly value: string;
	readonly label: string;
	readonly tone: StatusTone;
}

/** The status set when the example first renders. */
const PLANNED_STATUS: StatusOption = { value: "planned", label: "Planned", tone: "planned" };

const STATUS_OPTIONS: readonly StatusOption[] = [
	{ value: "backlog", label: "Backlog", tone: "backlog" },
	PLANNED_STATUS,
	{ value: "in-progress", label: "In Progress", tone: "inProgress" },
	{ value: "paused", label: "Paused", tone: "paused" },
	{ value: "completed", label: "Completed", tone: "completed" },
	{ value: "cancelled", label: "Cancelled", tone: "cancelled" },
];

const TRIGGER_BUTTON = <Button type="button" variant="outline" className="w-full justify-between font-normal" />;

function statusLabel(status: StatusOption): string {
	return status.label;
}

interface StatusGlyphProps {
	readonly tone: StatusTone;
	readonly className?: string;
}

function StatusGlyph({ tone, className }: StatusGlyphProps): React.JSX.Element {
	switch (tone) {
		case "backlog":
			return <CircleDotIcon className={cn("size-4 shrink-0 text-muted-foreground/70! **:text-muted-foreground/70!", className)} />;
		case "planned":
			return <CircleIcon className={cn("size-4 shrink-0 text-foreground/70! **:text-foreground/70!", className)} />;
		case "inProgress":
			return <CircleDotIcon className={cn("size-4 shrink-0 text-info! **:text-info!", className)} />;
		case "paused":
			return <PauseCircleIcon className={cn("size-4 shrink-0 text-warning! **:text-warning!", className)} />;
		case "completed":
			return <CircleCheckIcon className={cn("size-4 shrink-0 text-success! **:text-success!", className)} />;
		case "cancelled":
			return <CircleXIcon className={cn("size-4 shrink-0 text-muted-foreground! **:text-muted-foreground!", className)} />;
	}
}

interface StatusLabelProps {
	readonly status: StatusOption;
	readonly className?: string;
}

function StatusLabel({ status, className }: StatusLabelProps): React.JSX.Element {
	return (
		<span className={cn("flex min-w-0 items-center gap-2", className)}>
			<StatusGlyph tone={status.tone} />
			<span className="truncate">{status.label}</span>
		</span>
	);
}

function renderStatusItem(status: StatusOption): React.JSX.Element {
	return (
		<ComboboxItem key={status.value} value={status}>
			<StatusLabel status={status} />
		</ComboboxItem>
	);
}

export function Combobox21Example(): React.JSX.Element {
	const [status, setStatus] = useState<StatusOption | null>(PLANNED_STATUS);

	return (
		<Field className="max-w-xs">
			<Combobox items={STATUS_OPTIONS} value={status} onValueChange={setStatus} itemToStringValue={statusLabel} autoHighlight>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					{status === null ? <span className="text-muted-foreground">Set status</span> : <StatusLabel status={status} />}
				</ComboboxTrigger>

				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxInput showTrigger={false} placeholder="Change status" className="mb-1" />
					<ComboboxEmpty text="No statuses found." />
					<ComboboxList>
						<ComboboxCollection>{renderStatusItem}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
