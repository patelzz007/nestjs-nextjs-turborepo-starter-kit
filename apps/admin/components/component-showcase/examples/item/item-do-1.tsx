import * as React from "react";
import Link from "next/link";
import { Item, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item";

const PROJECT_LINK: React.JSX.Element = <Link href="#component-item" />;

export function ItemDo1Example(): React.JSX.Element {
	return (
		<Item variant="outline" render={PROJECT_LINK} className="w-full max-w-md">
			<ItemContent>
				<ItemTitle>Website relaunch</ItemTitle>
				<ItemDescription>12 tasks · due Friday</ItemDescription>
			</ItemContent>
		</Item>
	);
}
