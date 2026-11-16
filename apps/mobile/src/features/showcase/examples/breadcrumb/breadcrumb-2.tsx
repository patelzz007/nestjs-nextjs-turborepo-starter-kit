import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "home", label: "Home", onPress: ignorePress },
	{ key: "docs", label: "Documentation", onPress: ignorePress },
	{ key: "guides", label: "Guides", onPress: ignorePress },
	{ key: "auth", label: "Authentication", onPress: ignorePress },
	{ key: "sso", label: "Single sign-on" },
];

export function Breadcrumb2Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} maxItems={3} collapsedMenu />;
}
