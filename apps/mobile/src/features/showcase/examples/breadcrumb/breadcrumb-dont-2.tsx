import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "home", label: "Home" },
	{ key: "components", label: "Components" },
	{ key: "breadcrumb", label: "Breadcrumb" },
];

export function BreadcrumbDont2Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} />;
}
