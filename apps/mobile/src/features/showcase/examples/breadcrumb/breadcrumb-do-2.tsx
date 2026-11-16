import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "home", label: "Home", onPress: ignorePress },
	{ key: "components", label: "Components", onPress: ignorePress },
	{ key: "breadcrumb", label: "Breadcrumb" },
];

export function BreadcrumbDo2Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} />;
}
