import BookOpenIcon from "lucide-react-native/icons/book-open";
import CodeIcon from "lucide-react-native/icons/code";
import HomeIcon from "lucide-react-native/icons/home";
import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "home", label: "Home", icon: HomeIcon, onPress: ignorePress },
	{ key: "docs", label: "Docs", icon: BookOpenIcon, onPress: ignorePress },
	{ key: "api", label: "API", icon: CodeIcon },
];

export function Breadcrumb14Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} variant="buttons" />;
}
