import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import Link from "next/link";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item";

const PROJECT_LINK: React.JSX.Element = <Link href="#component-item" />;

export function ItemDont1Example(): React.JSX.Element {
	return (
		<Item variant="outline" render={PROJECT_LINK} className="w-full max-w-md">
			<ItemContent>
				<ItemTitle>Website relaunch</ItemTitle>
				<ItemDescription>12 tasks · due Friday</ItemDescription>
			</ItemContent>
			<ItemActions>
				<Button variant="outline" size="sm">
					Archive
				</Button>
			</ItemActions>
		</Item>
	);
}
