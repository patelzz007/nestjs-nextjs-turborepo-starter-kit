"use client";

import * as React from "react";
import { GripVerticalIcon, ImageIcon } from "lucide-react";
import { useState } from "react";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui/components/sortable";

interface GalleryImage {
	id: string;
	name: string;
	dimensions: string;
	size: string;
}

const defaultImages: GalleryImage[] = [
	{ id: "1", name: "hero-banner.jpg", dimensions: "1920×1080", size: "2.4 MB" },
	{ id: "2", name: "product-shot.png", dimensions: "800×600", size: "1.8 MB" },
	{ id: "3", name: "team-photo.jpg", dimensions: "1200×800", size: "3.2 MB" },
	{ id: "4", name: "logo-dark.svg", dimensions: "240×60", size: "12 KB" },
	{ id: "5", name: "og-image.png", dimensions: "1200×630", size: "890 KB" },
	{ id: "6", name: "favicon.ico", dimensions: "32×32", size: "4 KB" },
];

function getItemValue(item: GalleryImage): string {
	return item.id;
}

export function Sortable7Example(): React.JSX.Element {
	const [images, setImages] = useState<GalleryImage[]>(defaultImages);

	return (
		<div className="mx-auto w-full max-w-md">
			<Frame spacing="xs">
				<FrameHeader>
					<FrameTitle>Media Library</FrameTitle>
					<FrameDescription>Drag to reorder display priority</FrameDescription>
				</FrameHeader>
				<FramePanel className="p-2!">
					<Sortable value={images} onValueChange={setImages} getItemValue={getItemValue} strategy="grid" className="grid grid-cols-3 gap-2">
						{images.map((image) => (
							<SortableItem key={image.id} value={image.id}>
								<div className="group relative flex flex-col items-center justify-center gap-2 rounded-lg border bg-muted p-4">
									<SortableItemHandle className="absolute top-1.5 right-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground">
										<GripVerticalIcon className="size-3.5" />
									</SortableItemHandle>
									<ImageIcon className="size-5 text-muted-foreground" />
									<div className="w-full text-center">
										<p className="truncate text-xs font-medium">{image.name}</p>
										<p className="text-[10px] text-muted-foreground">
											{image.dimensions} &middot; {image.size}
										</p>
									</div>
								</div>
							</SortableItem>
						))}
					</Sortable>
				</FramePanel>
			</Frame>
		</div>
	);
}
