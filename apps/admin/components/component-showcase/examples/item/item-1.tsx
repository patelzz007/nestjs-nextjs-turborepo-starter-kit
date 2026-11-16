import * as React from "react";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item";

export function Item1Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-2">
			<Item>
				<ItemContent>
					<ItemTitle>Default Item</ItemTitle>
					<ItemDescription>A simple item with title and description.</ItemDescription>
				</ItemContent>
			</Item>
			<Item variant="outline">
				<ItemContent>
					<ItemTitle>Outline Item</ItemTitle>
					<ItemDescription>An outlined item with visible border.</ItemDescription>
				</ItemContent>
			</Item>
			<Item variant="muted">
				<ItemContent>
					<ItemTitle>Muted Item</ItemTitle>
					<ItemDescription>A muted item with subtle background.</ItemDescription>
				</ItemContent>
			</Item>
		</div>
	);
}
