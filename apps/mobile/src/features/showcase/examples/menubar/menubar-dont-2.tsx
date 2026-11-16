import { Menubar, type MenubarMenu } from "@workspace/ui-native/components/menubar";
import * as React from "react";

import { ignorePress } from "../example-support";

export function MenubarDont2Example(): React.JSX.Element {
	const menus: readonly MenubarMenu[] = [
		{
			key: "account",
			label: "Account",
			onSelect: ignorePress,
			items: [
				{ value: "signout", label: "Sign out" },
				{ value: "profile", label: "Profile" },
			],
		},
	];
	return <Menubar menus={menus} />;
}
