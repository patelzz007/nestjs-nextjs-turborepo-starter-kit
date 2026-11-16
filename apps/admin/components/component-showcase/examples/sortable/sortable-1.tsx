"use client";

import * as React from "react";
import { FileTextIcon, GripVerticalIcon, ImageIcon, MusicIcon, VideoIcon } from "lucide-react";
import { useState } from "react";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui/components/sortable";
import { toastMessage } from "@workspace/ui/components/toast";

interface MediaItem {
	id: string;
	title: string;
	description: string;
	type: "image" | "document" | "audio" | "video";
	size: string;
}

const defaultItems: MediaItem[] = [
	{
		id: "1",
		title: "Product Demo",
		description: "Main product image",
		type: "image",
		size: "2.4 MB",
	},
	{
		id: "2",
		title: "Product Specification",
		description: "Technical details document",
		type: "document",
		size: "1.2 MB",
	},
	{
		id: "3",
		title: "Product Demo Video",
		description: "How to use the product",
		type: "video",
		size: "15.7 MB",
	},
	{
		id: "4",
		title: "Product Audio Guide",
		description: "Audio instructions",
		type: "audio",
		size: "8.3 MB",
	},
	{
		id: "5",
		title: "Product Specification",
		description: "Additional product view",
		type: "image",
		size: "3.1 MB",
	},
];

const TYPE_ICONS: Readonly<Record<MediaItem["type"], React.ReactNode>> = {
	image: <ImageIcon className="h-4 w-4" />,
	document: <FileTextIcon className="h-4 w-4" />,
	audio: <MusicIcon className="h-4 w-4" />,
	video: <VideoIcon className="h-4 w-4" />,
};

const TYPE_VARIANTS: Readonly<Record<MediaItem["type"], BadgeVariant>> = {
	image: "primary-light",
	document: "success-light",
	audio: "destructive-light",
	video: "info-light",
};

function getItemValue(item: MediaItem): string {
	return item.id;
}

function describeOrder(items: readonly MediaItem[]): string {
	return items.map((item, index) => `${String(index + 1)}. ${item.title}`).join(", ");
}

export function Sortable1Example(): React.JSX.Element {
	const [items, setItems] = useState<MediaItem[]>(defaultItems);

	const handleValueChange = React.useCallback((newItems: MediaItem[]): void => {
		setItems(newItems);
		toastMessage.success({ title: "Items reordered successfully!", description: describeOrder(newItems) });
	}, []);

	return (
		<div className="mx-auto w-full max-w-xl space-y-8 p-6">
			<Sortable value={items} onValueChange={handleValueChange} getItemValue={getItemValue} strategy="vertical" className="space-y-2">
				{items.map((item) => (
					<SortableItem key={item.id} value={item.id}>
						<div className="flex items-center gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:bg-accent/50">
							<SortableItemHandle className="text-muted-foreground hover:text-foreground">
								<GripVerticalIcon className="h-4 w-4" />
							</SortableItemHandle>

							<div className="flex items-center gap-2 text-muted-foreground">{TYPE_ICONS[item.type]}</div>

							<div className="min-w-0 flex-1">
								<h4 className="truncate text-sm font-medium">{item.title}</h4>
								<p className="truncate text-xs text-muted-foreground">{item.description}</p>
							</div>

							<div className="flex items-center gap-2">
								<Badge variant={TYPE_VARIANTS[item.type]}>{item.type}</Badge>
								<span className="text-xs text-muted-foreground">{item.size}</span>
							</div>
						</div>
					</SortableItem>
				))}
			</Sortable>
		</div>
	);
}
