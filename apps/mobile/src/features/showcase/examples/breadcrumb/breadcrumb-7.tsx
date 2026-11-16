import { Avatar } from "@workspace/ui-native/components/avatar";
import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "team", label: "Design team", leading: <Avatar name="Design team" imageUrl={null} shape="rounded" size="sm" />, onPress: ignorePress },
	{ key: "user", label: "Ava Patel", leading: <Avatar name="Ava Patel" imageUrl={null} size="sm" />, onPress: ignorePress },
	{ key: "settings", label: "Settings" },
];

export function Breadcrumb7Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} />;
}
