import { NavigationMenu, type NavigationMenuItem } from "@workspace/ui-native/components/navigation-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly NavigationMenuItem[] = [
	{ key: "a", label: "Products", links: [{ key: "x", title: "All", onPress: ignorePress }] },
	{ key: "b", label: "Solutions", links: [{ key: "y", title: "All", onPress: ignorePress }] },
	{ key: "c", label: "Resources", links: [{ key: "z", title: "All", onPress: ignorePress }] },
	{ key: "d", label: "Company", links: [{ key: "w", title: "All", onPress: ignorePress }] },
	{ key: "e", label: "Pricing", links: [{ key: "v", title: "All", onPress: ignorePress }] },
];

export function NavigationMenuDont1Example(): React.JSX.Element {
	return <NavigationMenu items={ITEMS} />;
}
