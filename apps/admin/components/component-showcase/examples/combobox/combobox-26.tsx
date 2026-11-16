"use client";

import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxSeparator, ComboboxTrigger } from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import { cn } from "@workspace/ui/lib/core/utils";
import { TagIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useState } from "react";

interface EmptyLabelOption {
	readonly type: "none";
	readonly id: "no-label";
	readonly label: string;
	readonly searchText: string;
}

interface LabelOption {
	readonly type: "label";
	readonly id: string;
	readonly value: string;
	readonly label: string;
	/** The label's colour dot — a design-token background. */
	readonly colorClassName: string;
	readonly searchText: string;
}

type LabelSelectionItem = EmptyLabelOption | LabelOption;

const NO_LABEL_OPTION: EmptyLabelOption = {
	type: "none",
	id: "no-label",
	label: "No label",
	searchText: "No label clear labels remove labels empty",
};

const LABEL_OPTIONS: readonly LabelOption[] = [
	{ type: "label", id: "feature", value: "feature", label: "Feature", colorClassName: "bg-info", searchText: "Feature product enhancement capability" },
	{ type: "label", id: "bug", value: "bug", label: "Bug", colorClassName: "bg-destructive", searchText: "Bug issue defect problem" },
	{ type: "label", id: "improvement", value: "improvement", label: "Improvement", colorClassName: "bg-success", searchText: "Improvement refinement polish optimization" },
	{ type: "label", id: "design", value: "design", label: "Design", colorClassName: "bg-tone-violet", searchText: "Design ui ux creative visual" },
];

const LABEL_SELECTION_OPTIONS: readonly LabelSelectionItem[] = [NO_LABEL_OPTION, ...LABEL_OPTIONS];

/** How many colour dots the trigger shows before summarising the rest as a count. */
const MAX_TRIGGER_DOTS = 3;

const TRIGGER_BUTTON = <Button type="button" variant="outline" className="w-full justify-between font-normal" />;

function labelSearchText(item: LabelSelectionItem): string {
	return item.searchText;
}

function isLabelSelectionItemEqual(item: LabelSelectionItem, value: LabelSelectionItem): boolean {
	return item.id === value.id;
}

function isNoLabelOption(item: LabelSelectionItem): item is EmptyLabelOption {
	return item.type === "none";
}

function isLabelOption(item: LabelSelectionItem): item is LabelOption {
	return item.type === "label";
}

function LabelDot({ option }: { readonly option: LabelOption }): React.JSX.Element {
	return <span aria-hidden="true" className={cn("size-3 shrink-0 rounded-full", option.colorClassName)} />;
}

interface LabelTriggerSummaryProps {
	readonly selectedLabels: readonly LabelOption[];
	readonly placeholder: string;
}

function LabelTriggerSummary({ selectedLabels, placeholder }: LabelTriggerSummaryProps): React.JSX.Element {
	const [onlyLabel, ...otherLabels] = selectedLabels;

	if (onlyLabel === undefined) {
		return (
			<span className="flex min-w-0 items-center gap-2">
				<TagIcon className="size-4 shrink-0 text-muted-foreground" />
				<span className="truncate text-muted-foreground">{placeholder}</span>
			</span>
		);
	}

	if (otherLabels.length === 0) {
		return (
			<span className="flex min-w-0 items-center gap-2">
				<LabelDot option={onlyLabel} />
				<span className="truncate">{onlyLabel.label}</span>
			</span>
		);
	}

	const visibleLabels = selectedLabels.slice(0, MAX_TRIGGER_DOTS);
	const hiddenLabelCount = selectedLabels.length - visibleLabels.length;
	const selectedLabelText = selectedLabels.map((label: LabelOption): string => label.label).join(", ");

	return (
		<span className="flex min-w-0 items-center gap-1">
			<span className="sr-only">Selected labels: {selectedLabelText}</span>
			{visibleLabels.map((label: LabelOption): React.JSX.Element => (
				<LabelDot key={label.id} option={label} />
			))}
			{hiddenLabelCount > 0 ? <span className="ml-0.5 text-xs text-muted-foreground tabular-nums">+{hiddenLabelCount}</span> : null}
		</span>
	);
}

function LabelOptionRow({ option }: { readonly option: LabelSelectionItem }): React.JSX.Element {
	if (option.type === "none") {
		return <span className="truncate">{option.label}</span>;
	}

	return (
		<span className="flex min-w-0 items-center gap-2">
			<LabelDot option={option} />
			<span className="truncate">{option.label}</span>
		</span>
	);
}

export function Combobox26Example(): React.JSX.Element {
	const [labels, setLabels] = useState<LabelOption[]>(() => [...LABEL_OPTIONS]);

	// Picking "No label" clears the selection instead of joining it.
	const handleLabelsChange = useCallback((nextItems: LabelSelectionItem[]): void => {
		setLabels(nextItems.some(isNoLabelOption) ? [] : nextItems.filter(isLabelOption));
	}, []);

	return (
		<Field className="max-w-xs">
			<Combobox
				multiple
				items={LABEL_SELECTION_OPTIONS}
				value={labels}
				onValueChange={handleLabelsChange}
				itemToStringValue={labelSearchText}
				isItemEqualToValue={isLabelSelectionItemEqual}
				autoHighlight>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					<LabelTriggerSummary selectedLabels={labels} placeholder="Add label" />
				</ComboboxTrigger>

				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxInput showTrigger={false} placeholder="Select labels" className="mb-1" />
					<ComboboxEmpty text="No labels found." />
					<ComboboxList>
						<ComboboxItem value={NO_LABEL_OPTION}>
							<LabelOptionRow option={NO_LABEL_OPTION} />
						</ComboboxItem>
						<ComboboxSeparator />

						{LABEL_OPTIONS.map((item: LabelOption): React.JSX.Element => (
							<ComboboxItem key={item.id} value={item}>
								<LabelOptionRow option={item} />
							</ComboboxItem>
						))}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
