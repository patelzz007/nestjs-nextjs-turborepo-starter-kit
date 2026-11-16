import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

import { useToast } from "../../../toast/facade";

type GridType = "image" | "document" | "audio" | "video" | "featured";

interface GridItem {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly type: GridType;
}

const ITEMS: readonly GridItem[] = [
	{ id: "1", title: "Hero Image", description: "Main banner image", type: "image" },
	{ id: "2", title: "Product Specs", description: "Technical documentation", type: "document" },
	{ id: "3", title: "Demo Video", description: "Product demonstration", type: "video" },
	{ id: "4", title: "Audio Guide", description: "Voice instructions", type: "audio" },
	{ id: "5", title: "Gallery Photo 1", description: "Product view 1", type: "image" },
	{ id: "6", title: "Gallery Photo 2", description: "Product view 2", type: "image" },
	{ id: "7", title: "User Manual", description: "Installation guide", type: "document" },
	{ id: "8", title: "Background Music", description: "Ambient soundtrack", type: "audio" },
	{ id: "9", title: "Feature Highlight", description: "Key product features", type: "featured" },
];

const TYPE_TONES: Readonly<Record<GridType, BadgeTone>> = { image: "primary", document: "success", audio: "destructive", video: "info", featured: "warning" };

function getItemValue(item: GridItem): string {
	return item.id;
}

// A grid: drag a card onto another's place, or move it with a screen reader's actions.
export function Sortable2Example(): React.JSX.Element {
	const toast = useToast();
	const [items, setItems] = React.useState<readonly GridItem[]>(ITEMS);
	const reorder = React.useCallback(
		(next: readonly GridItem[]): void => {
			setItems(next);
			toast.success("Grid items reordered successfully!");
		},
		[toast],
	);
	return (
		<Sortable value={items} onValueChange={reorder} getItemValue={getItemValue} strategy="grid">
			{items.map((item: GridItem): React.JSX.Element => (
				<SortableItem key={item.id} value={item.id} label={item.title} className="w-1/3 p-1">
					<View className="min-h-28 gap-1 rounded-md border border-border bg-background p-2">
						<View className="flex-row items-start justify-between">
							<Badge label={item.type} tone={TYPE_TONES[item.type]} variant="light" size="sm" />
							<SortableItemHandle className="min-h-8 min-w-8">
								<Icon icon={GripVerticalIcon} size="xs" colorClassName="accent-muted-foreground" />
							</SortableItemHandle>
						</View>
						<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
							{item.title}
						</Text>
						<Text numberOfLines={2} className="text-caption font-sans text-muted-foreground">
							{item.description}
						</Text>
					</View>
				</SortableItem>
			))}
		</Sortable>
	);
}
