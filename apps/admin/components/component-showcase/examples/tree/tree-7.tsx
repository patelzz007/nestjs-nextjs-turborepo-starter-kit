"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { Tree, TreeItem, TreeItemLabel } from "@workspace/ui/components/tree";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";

import { Checkbox } from "@workspace/ui/components/checkbox";

interface PermissionItem {
	name: string;
	children?: string[];
}

const items: Record<string, PermissionItem> = {
	permissions: {
		name: "All Permissions",
		children: ["users", "content", "billing", "api"],
	},
	users: {
		name: "User Management",
		children: ["users-view", "users-create", "users-edit", "users-delete"],
	},
	"users-view": { name: "View users" },
	"users-create": { name: "Create users" },
	"users-edit": { name: "Edit users" },
	"users-delete": { name: "Delete users" },
	content: {
		name: "Content Management",
		children: ["content-view", "content-publish", "content-delete"],
	},
	"content-view": { name: "View content" },
	"content-publish": { name: "Publish content" },
	"content-delete": { name: "Delete content" },
	billing: { name: "Billing", children: ["billing-view", "billing-manage"] },
	"billing-view": { name: "View invoices" },
	"billing-manage": { name: "Manage subscriptions" },
	api: { name: "API Access", children: ["api-read", "api-write"] },
	"api-read": { name: "Read access" },
	"api-write": { name: "Write access" },
};

/** The sample data for an id. Every id the tree asks for comes from `items` itself, so a miss is a typo in the data. */
function lookupItem(itemId: string): PermissionItem {
	const item = items[itemId];
	if (item === undefined) {
		throw new Error(`Unknown tree item: ${itemId}`);
	}
	return item;
}

const indent = 24;

const INITIAL_CHECKED: ReadonlySet<string> = new Set(["users-view", "content-view", "content-publish", "billing-view", "api-read"]);

/** Keeps a click on the checkbox from also toggling the row it sits in. */
function stopRowToggle(event: React.MouseEvent): void {
	event.stopPropagation();
}

interface PermissionCheckboxProps {
	readonly id: string;
	readonly checked: boolean;
	readonly onToggle: (id: string) => void;
}

function PermissionCheckbox({ id, checked, onToggle }: PermissionCheckboxProps): React.JSX.Element {
	const handleCheckedChange = useCallback((): void => {
		onToggle(id);
	}, [id, onToggle]);

	return <Checkbox checked={checked} onCheckedChange={handleCheckedChange} className="size-3.5" onClick={stopRowToggle} />;
}

export function Tree7Example(): React.JSX.Element {
	const [checked, setChecked] = useState<ReadonlySet<string>>(INITIAL_CHECKED);

	const togglePermission = useCallback((id: string): void => {
		setChecked((prev: ReadonlySet<string>): ReadonlySet<string> => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const tree = useTree<PermissionItem>({
		initialState: {
			expandedItems: ["users", "content"],
		},
		indent,
		rootItemId: "permissions",
		getItemName: (item) => item.getItemData().name,
		isItemFolder: (item) => (item.getItemData().children?.length ?? 0) > 0,
		dataLoader: {
			getItem: lookupItem,
			getChildren: (itemId) => lookupItem(itemId).children ?? [],
		},
		features: [syncDataLoaderFeature, hotkeysCoreFeature],
	});

	return (
		<div className="mx-auto w-full grow place-self-start lg:w-xs">
			<Tree indent={indent} tree={tree} toggleIconType="plus-minus" className="">
				{tree.getItems().map((item) => {
					const id = item.getId();
					const isLeaf = !item.isFolder();

					return (
						<TreeItem key={id} item={item}>
							<TreeItemLabel className="not-in-data-[folder=true]:ps-5">
								<span className="flex items-center gap-2">
									{isLeaf ? <PermissionCheckbox id={id} checked={checked.has(id)} onToggle={togglePermission} /> : null}
									{item.getItemName()}
								</span>
							</TreeItemLabel>
						</TreeItem>
					);
				})}
			</Tree>
		</div>
	);
}
