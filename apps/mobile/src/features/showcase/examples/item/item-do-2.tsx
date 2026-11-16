import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui-native/components/item";
import * as React from "react";

const TITLE = "Quarterly Report.pdf";
const DESCRIPTION = "2.4 MB · Updated 2 hours ago";

export function ItemDo2Example(): React.JSX.Element {
	return (
		<Item variant="outline">
			<ItemContent>
				<ItemTitle>{TITLE}</ItemTitle>
				<ItemDescription>{DESCRIPTION}</ItemDescription>
			</ItemContent>
		</Item>
	);
}
