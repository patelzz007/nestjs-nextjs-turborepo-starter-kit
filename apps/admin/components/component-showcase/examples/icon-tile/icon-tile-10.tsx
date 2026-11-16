import * as React from "react";
import { FileTextIcon } from "lucide-react";
import { IconTile } from "@workspace/ui/components/icon-tile";

import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui/components/item";

export function IconTile10Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-sm items-center justify-center">
			<Item variant="outline">
				<ItemMedia>
					<IconTile tone="brand" variant="elevated" size="sm" aria-hidden="true">
						<FileTextIcon />
					</IconTile>
				</ItemMedia>
				<ItemContent>
					<ItemTitle>Quarterly report</ItemTitle>
					<ItemDescription>Updated 2 hours ago by Anna</ItemDescription>
				</ItemContent>
			</Item>
		</div>
	);
}
