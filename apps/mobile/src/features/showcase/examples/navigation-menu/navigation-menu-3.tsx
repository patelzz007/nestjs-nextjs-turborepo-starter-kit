import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleDashedIcon from "lucide-react-native/icons/circle-dashed";
import { NavigationMenu, type NavigationMenuItem } from "@workspace/ui-native/components/navigation-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly NavigationMenuItem[] = [
	{
		key: "status",
		label: "Status",
		links: [
			{ key: "backlog", title: "Backlog", icon: CircleDashedIcon, onPress: ignorePress },
			{ key: "done", title: "Done", icon: CircleCheckIcon, onPress: ignorePress },
		],
	},
];

export function NavigationMenu3Example(): React.JSX.Element {
	return <NavigationMenu items={ITEMS} />;
}
