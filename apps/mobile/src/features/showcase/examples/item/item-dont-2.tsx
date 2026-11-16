import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui-native/components/item";
import * as React from "react";

const TITLE = "Quarterly Report.pdf";
const DESCRIPTION =
	"This file is the quarterly report for the finance team. It was uploaded by Anna, last edited two hours ago, weighs 2.4 MB, and is shared with twelve people across three departments.";

// A paragraph in the description: the row cuts it off after two lines.
export function ItemDont2Example(): React.JSX.Element {
	return (
		<Item variant="outline">
			<ItemContent>
				<ItemTitle>{TITLE}</ItemTitle>
				<ItemDescription>{DESCRIPTION}</ItemDescription>
			</ItemContent>
		</Item>
	);
}
