import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import FileTextIcon from "lucide-react-native/icons/file-text";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import ImageIcon from "lucide-react-native/icons/image";
import MusicIcon from "lucide-react-native/icons/music";
import VideoIcon from "lucide-react-native/icons/video";
import * as React from "react";
import { Text, View } from "react-native";

import { useToast } from "../../../toast/facade";

type MediaType = "image" | "document" | "audio" | "video";

interface MediaItem {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly type: MediaType;
	readonly size: string;
}

const ITEMS: readonly MediaItem[] = [
	{ id: "1", title: "Product Demo", description: "Main product image", type: "image", size: "2.4 MB" },
	{ id: "2", title: "Product Specification", description: "Technical details document", type: "document", size: "1.2 MB" },
	{ id: "3", title: "Product Demo Video", description: "How to use the product", type: "video", size: "15.7 MB" },
	{ id: "4", title: "Product Audio Guide", description: "Audio instructions", type: "audio", size: "8.3 MB" },
	{ id: "5", title: "Product Specification", description: "Additional product view", type: "image", size: "3.1 MB" },
];

const TYPE_ICONS: Readonly<Record<MediaType, LucideIcon>> = { image: ImageIcon, document: FileTextIcon, audio: MusicIcon, video: VideoIcon };
const TYPE_TONES: Readonly<Record<MediaType, BadgeTone>> = { image: "primary", document: "success", audio: "destructive", video: "info" };

function getItemValue(item: MediaItem): string {
	return item.id;
}

function describeOrder(items: readonly MediaItem[]): string {
	return items.map((item: MediaItem, index: number): string => `${String(index + 1)}. ${item.title}`).join(", ");
}

export function Sortable1Example(): React.JSX.Element {
	const toast = useToast();
	const [items, setItems] = React.useState<readonly MediaItem[]>(ITEMS);
	const reorder = React.useCallback(
		(next: readonly MediaItem[]): void => {
			setItems(next);
			toast.success(describeOrder(next), { title: "Items reordered successfully!" });
		},
		[toast],
	);
	return (
		<Sortable value={items} onValueChange={reorder} getItemValue={getItemValue} className="gap-2">
			{items.map((item: MediaItem): React.JSX.Element => (
				<SortableItem key={item.id} value={item.id} label={item.title}>
					<View className="flex-row items-center gap-3 rounded-md border border-border bg-background p-2">
						<SortableItemHandle>
							<Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />
						</SortableItemHandle>
						<Icon icon={TYPE_ICONS[item.type]} size="sm" colorClassName="accent-muted-foreground" />
						<View className="flex-1">
							<Text numberOfLines={1} className="text-label font-sans-medium text-foreground">
								{item.title}
							</Text>
							<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
								{item.description}
							</Text>
						</View>
						<View className="items-end gap-1">
							<Badge label={item.type} tone={TYPE_TONES[item.type]} variant="light" size="sm" />
							<Text className="text-caption font-sans text-muted-foreground">{item.size}</Text>
						</View>
					</View>
				</SortableItem>
			))}
		</Sortable>
	);
}
