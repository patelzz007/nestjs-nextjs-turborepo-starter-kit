import * as React from "react";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item";

export function ItemDo2Example(): React.JSX.Element {
	return (
		<Item variant="outline" className="w-full max-w-md">
			<ItemContent>
				<ItemTitle>Website relaunch</ItemTitle>
				<ItemDescription>12 tasks · due Friday · 3 members</ItemDescription>
			</ItemContent>
		</Item>
	);
}
