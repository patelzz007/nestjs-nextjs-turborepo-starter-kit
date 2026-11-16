"use client";

import * as React from "react";
import { ChevronRightIcon, DownloadIcon, FileIcon, FolderIcon, TrashIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { Item, ItemActions, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

type FileTreeItem = { readonly name: string } | { readonly name: string; readonly items: readonly FileTreeItem[] };

interface TreeItemProps {
	readonly item: FileTreeItem;
	readonly level?: number;
	readonly selectedId: string | null;
	readonly onSelect: (name: string) => void;
}

const fileTree: readonly FileTreeItem[] = [
	{
		name: "components",
		items: [
			{
				name: "ui",
				items: [{ name: "button.tsx" }, { name: "card.tsx" }, { name: "dialog.tsx" }],
			},
			{ name: "login-form.tsx" },
		],
	},
	{
		name: "lib",
		items: [{ name: "utils.ts" }, { name: "api.ts" }],
	},
	{
		name: "hooks",
		items: [{ name: "use-debounce.ts" }, { name: "use-local-storage.ts" }],
	},
	{ name: "app.tsx" },
	{ name: "package.json" },
];

/** Each tree level indents by this much, on top of the row's base padding (px). */
const LEVEL_INDENT_PX = 12;
const FOLDER_BASE_PADDING_PX = 8;
const FILE_BASE_PADDING_PX = 9;

/** The left padding for a row at \`level\`. */
function indentStyle(level: number, basePadding: number): React.CSSProperties {
	return { paddingLeft: `${String(level * LEVEL_INDENT_PX + basePadding)}px` };
}

function TreeItem({ item, level = 0, selectedId, onSelect }: TreeItemProps): React.JSX.Element {
	const isSelected = selectedId === item.name;
	const folderStyle = useMemo((): React.CSSProperties => indentStyle(level, FOLDER_BASE_PADDING_PX), [level]);
	const fileStyle = useMemo((): React.CSSProperties => indentStyle(level, FILE_BASE_PADDING_PX), [level]);
	const handleClick = useCallback((): void => {
		onSelect(item.name);
	}, [item.name, onSelect]);

	if ("items" in item) {
		return (
			<Collapsible>
				<CollapsibleTrigger
					render={
						<Item
							render={<button type="button" />}
							size="xs"
							className="cursor-pointer py-1.5 hover:bg-accent focus-visible:ring-inset aria-expanded:bg-accent"
							style={folderStyle}
						/>
					}>
					<ItemMedia variant="icon">
						<ChevronRightIcon aria-hidden="true" className="size-3 text-muted-foreground transition-transform in-aria-expanded:rotate-90" />
						<FolderIcon aria-hidden="true" className="size-3.5 text-muted-foreground group-hover/item:text-foreground" />
					</ItemMedia>
					<ItemTitle className="text-sm">{item.name}</ItemTitle>
				</CollapsibleTrigger>
				<CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
					<div className="flex flex-col gap-0.5 ps-1.5 pt-0.5">
						{item.items.map((child: FileTreeItem): React.JSX.Element => (
							<TreeItem key={child.name} item={child} level={level + 1} selectedId={selectedId} onSelect={onSelect} />
						))}
					</div>
				</CollapsibleContent>
			</Collapsible>
		);
	}

	return (
		<Item className="group/item cursor-pointer py-1.5 hover:bg-accent data-[active=true]:bg-accent" data-active={isSelected} style={fileStyle} onClick={handleClick}>
			<ItemMedia variant="icon">
				<FileIcon aria-hidden="true" className="size-4 text-muted-foreground group-hover/item:text-foreground group-data-[active=true]/item:text-foreground" />
			</ItemMedia>
			<ItemTitle className="text-sm text-secondary-foreground group-hover/item:text-foreground group-data-[active=true]/item:text-foreground">{item.name}</ItemTitle>
			<ItemActions className="-mr-2 ml-auto gap-0 opacity-0 transition-opacity group-hover/item:opacity-100 group-data-[active=true]/item:opacity-100">
				<Button size="icon-xs" variant="ghost">
					<DownloadIcon aria-hidden="true" />
				</Button>
				<Button variant="ghost" size="icon-xs">
					<TrashIcon aria-hidden="true" />
				</Button>
			</ItemActions>
		</Item>
	);
}

export function Collapsible10Example(): React.JSX.Element {
	const [selectedId, setSelectedId] = useState<string | null>(null);

	return (
		<div className="min-h-64 w-72">
			<Card size="sm" className="gap-1 p-1">
				<CardHeader className="p-0">
					<Tabs defaultValue="explorer">
						<TabsList className="h-8 w-full bg-accent p-1">
							<TabsTrigger value="explorer" className="text-xs">
								Explorer
							</TabsTrigger>
							<TabsTrigger value="outline" className="text-xs">
								Outline
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</CardHeader>
				<CardContent className="p-0">
					<div className="flex flex-col gap-0.5">
						{fileTree.map((item: FileTreeItem): React.JSX.Element => (
							<TreeItem key={item.name} item={item} selectedId={selectedId} onSelect={setSelectedId} />
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
