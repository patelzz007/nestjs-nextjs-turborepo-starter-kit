import { Button } from "@workspace/ui-native/components/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui-native/components/item";
import * as React from "react";

import { ignorePress } from "../example-support";

const TITLE = "Backups";
const DESCRIPTION = "Last backup 2 hours ago";

export function ItemDo1Example(): React.JSX.Element {
	return (
		<Item variant="outline">
			<ItemContent>
				<ItemTitle>{TITLE}</ItemTitle>
				<ItemDescription>{DESCRIPTION}</ItemDescription>
			</ItemContent>
			<ItemActions>
				<Button label="Back up now" variant="outline" size="sm" onPress={ignorePress} />
			</ItemActions>
		</Item>
	);
}
