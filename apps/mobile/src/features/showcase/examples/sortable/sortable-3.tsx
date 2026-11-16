import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

import { useToast } from "../../../toast/facade";

interface OptionValue {
	readonly id: string;
	readonly value: string;
}

interface OptionGroup {
	readonly id: string;
	readonly name: string;
	readonly values: readonly OptionValue[];
}

const GROUPS: readonly OptionGroup[] = [
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

function describe(names: readonly string[]): string {
	return names.map((name: string, index: number): string => `${String(index + 1)}. ${name}`).join(", ");
}

const GRIP = <Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />;

function OptionValueList({
	group,
	onReorder,
}: {
	readonly group: OptionGroup;
	readonly onReorder: (groupId: string, values: readonly OptionValue[]) => void;
}): React.JSX.Element {
	const reorder = React.useCallback(
		(values: readonly OptionValue[]): void => {
			onReorder(group.id, values);
		},
		[group.id, onReorder],
	);
	return (
		<Sortable value={group.values} onValueChange={reorder} getItemValue={getChildValue} className="gap-2">
			{group.values.map((value: OptionValue): React.JSX.Element => (
				<SortableItem key={value.id} value={value.id} label={value.value}>
					<View className="flex-row items-center gap-2 rounded-md border border-border px-1">
						<SortableItemHandle>{GRIP}</SortableItemHandle>
						<Text className="text-label flex-1 font-sans text-foreground">{value.value}</Text>
					</View>
				</SortableItem>
			))}
		</Sortable>
	);
}

// Groups reorder among themselves, and each group's values inside it: one sortable nested in another.
export function Sortable3Example(): React.JSX.Element {
	const toast = useToast();
	const [groups, setGroups] = React.useState<readonly OptionGroup[]>(GROUPS);
	const reorderGroups = React.useCallback(
		(next: readonly OptionGroup[]): void => {
			setGroups(next);
			toast.success(describe(next.map((group: OptionGroup): string => group.name)), { title: "Option groups reordered successfully!" });
		},
		[toast],
	);
	const reorderValues = React.useCallback(
		(groupId: string, values: readonly OptionValue[]): void => {
			setGroups((current: readonly OptionGroup[]): readonly OptionGroup[] =>
				current.map((group: OptionGroup): OptionGroup => (group.id === groupId ? { ...group, values } : group)),
			);
			toast.success(describe(values.map((value: OptionValue): string => value.value)), { title: "Values reordered successfully!" });
		},
		[toast],
	);
	return (
		<Sortable value={groups} onValueChange={reorderGroups} getItemValue={getParentValue} className="gap-4">
			{groups.map((group: OptionGroup): React.JSX.Element => (
				<SortableItem key={group.id} value={group.id} label={group.name}>
					<View className="gap-3 rounded-lg border border-border bg-background p-3">
						<View className="flex-row items-center gap-2">
							<SortableItemHandle>{GRIP}</SortableItemHandle>
							<Text className="text-label font-sans-semibold text-foreground">{group.name}</Text>
						</View>
						<OptionValueList group={group} onReorder={reorderValues} />
					</View>
				</SortableItem>
			))}
		</Sortable>
	);
}
