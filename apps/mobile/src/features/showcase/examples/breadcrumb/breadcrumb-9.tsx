import HomeIcon from "lucide-react-native/icons/home";
import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "home", label: "Home", icon: HomeIcon, iconOnly: true, onPress: ignorePress },
	{ key: "settings", label: "Settings", onPress: ignorePress },
	{ key: "billing", label: "Billing" },
];

export function Breadcrumb9Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} variant="card" />;
}
