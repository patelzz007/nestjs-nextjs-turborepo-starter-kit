"use client";

import * as React from "react";
import { FileIcon } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { Progress } from "@workspace/ui/components/progress";

const files = [
	{ id: "1", name: "document.pdf", progress: 45, status: "2m 30s" },
	{ id: "2", name: "presentation.pptx", progress: 78, status: "45s" },
	{ id: "3", name: "spreadsheet.xlsx", progress: 12, status: "5m 12s" },
	{ id: "4", name: "image.jpg", progress: 100, status: "Complete" },
];

export function Progress5Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-xs flex-col">
			<ItemGroup>
				{files.map((file) => (
					<Item key={file.id} size="xs" className="px-0">
						<ItemMedia variant="icon">
							<FileIcon className="size-4 text-muted-foreground" />
						</ItemMedia>
						<ItemContent className="flex-1 truncate">
							<ItemTitle className="cursor-pointer truncate hover:underline">{file.name}</ItemTitle>
						</ItemContent>
						<ItemContent className="w-32">
							<Progress value={file.progress} className="**:data-[slot=progress-track]:h-1" />
						</ItemContent>
						<ItemActions className="w-20 justify-end">
							<span className="text-foreground">{file.status}</span>
						</ItemActions>
					</Item>
				))}
			</ItemGroup>
		</div>
	);
}
