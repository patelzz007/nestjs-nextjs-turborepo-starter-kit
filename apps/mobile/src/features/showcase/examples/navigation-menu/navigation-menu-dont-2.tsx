import { NavigationMenu, type NavigationMenuItem } from "@workspace/ui-native/components/navigation-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly NavigationMenuItem[] = [
	{
		key: "status",
		label: "Status",
		links: [
			{ key: "a", title: "Click here", onPress: ignorePress },
			{ key: "b", title: "More", onPress: ignorePress },
		],
	},
];

export function NavigationMenuDont2Example(): React.JSX.Element {
	return <NavigationMenu items={ITEMS} />;
}
