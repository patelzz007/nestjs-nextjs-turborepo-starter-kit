import { NavigationMenu, type NavigationMenuItem } from "@workspace/ui-native/components/navigation-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly NavigationMenuItem[] = [
	{
		key: "components",
		label: "Components",
		columns: 2,
		links: [
			{ key: "alert", title: "Alert dialog", description: "Interrupts with important content.", onPress: ignorePress },
			{ key: "hover", title: "Hover card", description: "Previews content behind a link.", onPress: ignorePress },
			{ key: "progress", title: "Progress", description: "Shows how far a task has gone.", onPress: ignorePress },
			{ key: "tabs", title: "Tabs", description: "Layered sections shown one at a time.", onPress: ignorePress },
		],
	},
];

export function NavigationMenu2Example(): React.JSX.Element {
	return <NavigationMenu items={ITEMS} />;
}
