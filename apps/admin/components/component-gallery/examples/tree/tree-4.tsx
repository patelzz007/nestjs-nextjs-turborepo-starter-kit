"use client";

import * as React from "react";
import { FileIcon, FolderIcon, FolderOpenIcon } from "lucide-react";
import { Tree, TreeItem, TreeItemLabel } from "@workspace/ui/components/tree";
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";

interface Item {
	name: string;
	children?: string[];
}

const items: Record<string, Item> = {
	crm: {
		name: "CRM",
		children: ["leads", "accounts", "activities", "support"],
	},
	leads: {
		name: "Leads",
		children: ["new-lead", "contacted-lead", "qualified-lead"],
	},
	"new-lead": { name: "New Lead" },
	"contacted-lead": { name: "Contacted Lead" },
	"qualified-lead": { name: "Qualified Lead" },
	accounts: {
		name: "Accounts",
		children: ["acme-corp", "globex-inc"],
	},
	"acme-corp": {
		name: "Acme Corp",
		children: ["acme-contacts", "acme-opportunities"],
	},
	"acme-contacts": {
		name: "Contacts",
		children: ["john-smith", "jane-doe"],
	},
	"john-smith": { name: "John Smith" },
	"jane-doe": { name: "Jane Doe" },
	"acme-opportunities": {
		name: "Opportunities",
		children: ["website-redesign", "annual-maintenance"],
	},
	"website-redesign": { name: "Website Redesign" },
	"annual-maintenance": { name: "Annual Maintenance" },
	"globex-inc": {
		name: "Globex Inc",
		children: ["globex-contacts", "globex-opportunities"],
	},
	"globex-contacts": {
		name: "Contacts",
		children: ["alice-johnson"],
	},
	"alice-johnson": { name: "Alice Johnson" },
	"globex-opportunities": {
		name: "Opportunities",
		children: ["cloud-migration"],
	},
	"cloud-migration": { name: "Cloud Migration" },
	activities: {
		name: "Activities",
		children: ["calls", "meetings", "emails"],
	},
	calls: { name: "Calls" },
	meetings: { name: "Meetings" },
	emails: { name: "Emails" },
	support: {
		name: "Support",
		children: ["open-tickets", "closed-tickets"],
	},
	"open-tickets": { name: "Open Tickets" },
	"closed-tickets": { name: "Closed Tickets" },
};

/** The sample data for an id. Every id the tree asks for comes from `items` itself, so a miss is a typo in the data. */
function lookupItem(itemId: string): Item {
	const item = items[itemId];
	if (item === undefined) {
		throw new Error(`Unknown tree item: ${itemId}`);
	}
	return item;
}

const indent = 20;

export function Tree4Example(): React.JSX.Element {
	const tree = useTree<Item>({
		initialState: {
			expandedItems: ["leads", "accounts", "activities"],
		},
		indent,
		rootItemId: "crm",
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
			<Tree
				className="relative before:absolute before:inset-0 before:-ms-1.25 before:bg-[repeating-linear-gradient(to_right,transparent_0,transparent_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)-1px),var(--border)_calc(var(--tree-indent)))]"
				indent={indent}
				tree={tree}
				toggleIconType="plus-minus">
				{tree.getItems().map((item) => {
					return (
						<TreeItem key={item.getId()} item={item}>
							<TreeItemLabel className="relative before:absolute before:inset-x-0 before:-inset-y-0.5 before:-z-10 before:bg-background">
								<span className="ms-1 flex items-center gap-2">
									{item.isFolder() ? (
										item.isExpanded() ? (
											<FolderOpenIcon className="pointer-events-none size-4 text-muted-foreground" />
										) : (
											<FolderIcon className="pointer-events-none size-4 text-muted-foreground" />
										)
									) : (
										<FileIcon className="pointer-events-none size-4 text-muted-foreground" />
									)}
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
