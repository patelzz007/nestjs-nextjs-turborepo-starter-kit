import HomeIcon from "lucide-react-native/icons/home";
import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "home", label: "Home", icon: HomeIcon, iconOnly: true, onPress: ignorePress },
	{ key: "library", label: "Library", onPress: ignorePress },
	{ key: "data", label: "Data" },
];

export function Breadcrumb10Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} variant="pill" />;
}
