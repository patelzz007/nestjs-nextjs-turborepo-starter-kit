"use client";

import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import { useState } from "react";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui/components/sortable";
import { toastMessage } from "@workspace/ui/components/toast";

import { Card, CardContent } from "@workspace/ui/components/card";

interface OptionValue {
	id: string;
	value: string;
}

interface OptionGroup {
	id: string;
	name: string;
	values: OptionValue[];
}

const defaultOptionGroups: OptionGroup[] = [
	{
		id: "1",
		name: "Colors",
		values: [
			{ id: "1-1", value: "White" },
			{ id: "1-2", value: "Black" },
			{ id: "1-3", value: "Grey" },
			{ id: "1-4", value: "Green" },
		],
	},
	{
		id: "2",
		name: "Sizes",
		values: [
			{ id: "2-1", value: "Small" },
			{ id: "2-2", value: "Medium" },
			{ id: "2-3", value: "Large" },
		],
	},
	{
		id: "3",
		name: "Materials",
		values: [
			{ id: "3-1", value: "Cotton" },
			{ id: "3-2", value: "Polyester" },
			{ id: "3-3", value: "Wool" },
		],
	},
];

function getParentValue(group: OptionGroup): string {
	return group.id;
}

function getChildValue(value: OptionValue): string {
	return value.id;
}

function describeGroups(groups: readonly OptionGroup[]): string {
	return groups.map((group, index) => `${String(index + 1)}. ${group.name}`).join(", ");
}

function describeValues(values: readonly OptionValue[]): string {
	return values.map((value, index) => `${String(index + 1)}. ${value.value}`).join(", ");
}

interface OptionValueListProps {
	readonly group: OptionGroup;
	readonly onReorder: (groupId: string, values: OptionValue[]) => void;
}

/** The child-level list of one option group; binds the group id once so the handler stays stable. */
function OptionValueList({ group, onReorder }: OptionValueListProps): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(values: OptionValue[]): void => {
			onReorder(group.id, values);
		},
		[group.id, onReorder],
	);

	return (
		<Sortable value={group.values} onValueChange={handleValueChange} getItemValue={getChildValue} strategy="vertical" className="space-y-2">
			{group.values.map((value) => (
				<SortableItem key={value.id} value={value.id}>
					<div className="flex items-center gap-2 rounded-md border border-border p-1.5">
						<SortableItemHandle className="cursor-grab text-muted-foreground hover:text-foreground">
							<GripVerticalIcon className="h-4 w-4" />
						</SortableItemHandle>
						<span className="flex-1 text-sm">{value.value}</span>
					</div>
				</SortableItem>
			))}
		</Sortable>
	);
}

export function Sortable3Example(): React.JSX.Element {
	const [optionGroups, setOptionGroups] = useState<OptionGroup[]>(defaultOptionGroups);

	const handleParentReorder = React.useCallback((newGroups: OptionGroup[]): void => {
		setOptionGroups(newGroups);
		toastMessage.success({ title: "Option groups reordered successfully!", description: describeGroups(newGroups) });
	}, []);

	const handleChildReorder = React.useCallback((groupId: string, newValues: OptionValue[]): void => {
		setOptionGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, values: newValues } : group)));
		toastMessage.success({ title: "Values reordered successfully!", description: describeValues(newValues) });
	}, []);

	return (
		<div className="mx-auto w-full max-w-sm space-y-6 p-6">
			<Sortable value={optionGroups} onValueChange={handleParentReorder} getItemValue={getParentValue} strategy="vertical" className="space-y-4">
				{optionGroups.map((group) => (
					<SortableItem key={group.id} value={group.id}>
						<Card className="p-2">
							<CardContent className="p-0">
								{/* Group Header */}
								<div className="mb-2 flex items-center gap-2">
									<SortableItemHandle className="cursor-grab text-muted-foreground hover:text-foreground">
										<GripVerticalIcon className="h-4 w-4" />
									</SortableItemHandle>
									<h3 className="text-sm font-semibold">{group.name}</h3>
								</div>

								{/* Option Values - Child Level */}
								<OptionValueList group={group} onReorder={handleChildReorder} />
							</CardContent>
						</Card>
					</SortableItem>
				))}
			</Sortable>
		</div>
	);
}
