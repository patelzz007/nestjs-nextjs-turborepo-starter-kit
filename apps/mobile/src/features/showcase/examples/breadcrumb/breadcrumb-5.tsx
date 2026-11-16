import FileTextIcon from "lucide-react-native/icons/file-text";
import FolderIcon from "lucide-react-native/icons/folder";
import HomeIcon from "lucide-react-native/icons/home";
import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "home", label: "Home", icon: HomeIcon, onPress: ignorePress },
	{ key: "projects", label: "Projects", icon: FolderIcon, onPress: ignorePress },
	{ key: "roadmap", label: "Roadmap", icon: FileTextIcon },
];

export function Breadcrumb5Example(): React.JSX.Element {
	return <Breadcrumb items={ITEMS} />;
}
