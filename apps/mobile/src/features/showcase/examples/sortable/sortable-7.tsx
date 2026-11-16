import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import { Icon } from "@workspace/ui-native/components/icon";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui-native/components/sortable";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import ImageIcon from "lucide-react-native/icons/image";
import * as React from "react";
import { Text, View } from "react-native";

interface ImageFile {
	readonly id: string;
	readonly name: string;
	readonly dimensions: string;
	readonly size: string;
}

const IMAGES: readonly ImageFile[] = [
	{ id: "1", name: "hero-banner.jpg", dimensions: "1920×1080", size: "2.4 MB" },
	{ id: "2", name: "product-shot.png", dimensions: "800×600", size: "1.8 MB" },
	{ id: "3", name: "team-photo.jpg", dimensions: "1200×800", size: "3.2 MB" },
	{ id: "4", name: "logo-dark.svg", dimensions: "240×60", size: "12 KB" },
	{ id: "5", name: "og-image.png", dimensions: "1200×630", size: "890 KB" },
	{ id: "6", name: "favicon.ico", dimensions: "32×32", size: "4 KB" },
];

const TITLE = "Media Library";
const DESCRIPTION = "Drag to reorder display priority";

function getItemValue(image: ImageFile): string {
	return image.id;
}

export function Sortable7Example(): React.JSX.Element {
	const [images, setImages] = React.useState<readonly ImageFile[]>(IMAGES);
	return (
		<Frame>
			<FrameHeader>
				<FrameTitle>{TITLE}</FrameTitle>
				<FrameDescription>{DESCRIPTION}</FrameDescription>
			</FrameHeader>
			<FramePanel className="p-1">
				<Sortable value={images} onValueChange={setImages} getItemValue={getItemValue} strategy="grid">
					{images.map((image: ImageFile): React.JSX.Element => (
						<SortableItem key={image.id} value={image.id} label={image.name} className="w-1/3 p-1">
							<View className="overflow-hidden rounded-md border border-border">
								<View className="aspect-square items-center justify-center bg-muted">
									<Icon icon={ImageIcon} size="lg" colorClassName="accent-muted-foreground" />
									<SortableItemHandle className="absolute top-0 right-0 min-h-8 min-w-8">
										<Icon icon={GripVerticalIcon} size="xs" colorClassName="accent-muted-foreground" />
									</SortableItemHandle>
								</View>
								<View className="p-1.5">
									<Text numberOfLines={1} className="text-caption font-sans-medium text-foreground">
										{image.name}
									</Text>
									<Text numberOfLines={1} className="text-overline font-sans text-muted-foreground">{`${image.dimensions} · ${image.size}`}</Text>
								</View>
							</View>
						</SortableItem>
					))}
				</Sortable>
			</FramePanel>
		</Frame>
	);
}
