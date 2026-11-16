import * as React from "react";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item";

export function ItemDont2Example(): React.JSX.Element {
	return (
		<Item variant="outline" className="w-full max-w-md">
			<ItemContent>
				<ItemTitle>Website relaunch</ItemTitle>
				<ItemDescription>
					This project covers the whole relaunch of the marketing website, from the new information architecture and copy through the design system migration, the content
					freeze, the QA pass and the launch announcement, with three members and twelve open tasks due by Friday.
				</ItemDescription>
			</ItemContent>
		</Item>
	);
}
