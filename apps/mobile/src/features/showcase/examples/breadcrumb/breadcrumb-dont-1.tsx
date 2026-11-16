import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "home", label: "Home", onPress: ignorePress },
	{ key: "a", label: "Workspace", onPress: ignorePress },
	{ key: "b", label: "Documentation", onPress: ignorePress },
	{ key: "c", label: "Guides", onPress: ignorePress },
	{ key: "d", label: "Authentication", onPress: ignorePress },
	{ key: "e", label: "Providers", onPress: ignorePress },
	{ key: "f", label: "Single sign-on" },
];

export function BreadcrumbDont1Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} separator="slash" />;
}
