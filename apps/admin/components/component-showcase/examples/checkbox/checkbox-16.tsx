"use client";

import * as React from "react";
import { useCallback, useState } from "react";

import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

interface Item {
	readonly id: string;
	readonly label: string;
	readonly children?: readonly Item[];
}

const data: readonly Item[] = [
	{
		id: "admin",
		label: "Administration",
		children: [
			{
				id: "user-management",
				label: "User Management",
				children: [
					{ id: "view-users", label: "View Users" },
					{ id: "create-users", label: "Create Users" },
					{ id: "edit-users", label: "Edit Users" },
				],
			},
			{
				id: "role-management",
				label: "Role Management",
				children: [
					{ id: "view-roles", label: "View Roles" },
					{ id: "assign-roles", label: "Assign Roles" },
				],
			},
		],
	},
];

type CheckedMap = Readonly<Record<string, boolean>>;

const INITIAL_CHECKED: CheckedMap = {
	"view-users": true,
	"create-users": true,
	"view-roles": true,
};

/** The top level of the tree is emphasised. */
const ROOT_LEVEL = 0;

/** Every leaf permission under (or at) a node. */
function getLeafIds(item: Item): string[] {
	if (!item.children) {
		return [item.id];
	}
	return item.children.flatMap(getLeafIds);
}

/** A node is checked when every leaf below it is. */
function isFullyChecked(item: Item, checked: CheckedMap): boolean {
	return getLeafIds(item).every((id: string): boolean => checked[id] === true);
}

/** A node is indeterminate when only some of the leaves below it are checked. */
function isPartlyChecked(item: Item, checked: CheckedMap): boolean {
	const leafIds = getLeafIds(item);
	const checkedCount = leafIds.filter((id: string): boolean => checked[id] === true).length;
	return checkedCount > 0 && checkedCount < leafIds.length;
}

interface PermissionNodeProps {
	readonly item: Item;
	readonly level: number;
	readonly checked: CheckedMap;
	readonly onToggle: (item: Item) => void;
}

function PermissionNode({ item, level, checked, onToggle }: PermissionNodeProps): React.JSX.Element {
	const handleCheckedChange = useCallback((): void => {
		onToggle(item);
	}, [item, onToggle]);

	return (
		<div className="flex flex-col gap-3">
			<Field orientation="horizontal">
				<Checkbox id={item.id} checked={isFullyChecked(item, checked)} indeterminate={isPartlyChecked(item, checked)} onCheckedChange={handleCheckedChange} />
				<FieldLabel htmlFor={item.id} className={level === ROOT_LEVEL ? "font-semibold" : "text-sm"}>
					{item.label}
				</FieldLabel>
			</Field>
			{item.children ? (
				<div className="ml-7 flex flex-col gap-3">
					{item.children.map((child: Item): React.JSX.Element => (
						<PermissionNode key={child.id} item={child} level={level + 1} checked={checked} onToggle={onToggle} />
					))}
				</div>
			) : null}
		</div>
	);
}

export function Checkbox16Example(): React.JSX.Element {
	const [checked, setChecked] = useState<CheckedMap>(INITIAL_CHECKED);

	/** Checks every leaf under the node, or clears them all when it was fully checked. */
	const toggle = useCallback((item: Item): void => {
		setChecked((current: CheckedMap): CheckedMap => {
			const shouldCheck = !isFullyChecked(item, current);
			const next: Record<string, boolean> = { ...current };
			for (const id of getLeafIds(item)) {
				next[id] = shouldCheck;
			}
			return next;
		});
	}, []);

	return (
		<div className="mx-auto flex flex-col gap-3">
			{data.map((item: Item): React.JSX.Element => (
				<PermissionNode key={item.id} item={item} level={ROOT_LEVEL} checked={checked} onToggle={toggle} />
			))}
		</div>
	);
}
