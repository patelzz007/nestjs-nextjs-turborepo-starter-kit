import { NavigationMenu, type NavigationMenuItem } from "@workspace/ui-native/components/navigation-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly NavigationMenuItem[] = [
	{
		key: "start",
		label: "Getting started",
		links: [
			{ key: "intro", title: "Introduction", description: "Reusable components built with the kit.", onPress: ignorePress },
			{ key: "install", title: "Installation", description: "How to install the dependencies.", onPress: ignorePress },
		],
	},
	{ key: "docs", label: "Documentation", onPress: ignorePress },
];

export function NavigationMenu1Example(): React.JSX.Element {
	return <NavigationMenu items={ITEMS} />;
}
