import HomeIcon from "lucide-react-native/icons/home";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { Breadcrumb, type BreadcrumbItemData } from "@workspace/ui-native/components/breadcrumb";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

const ITEMS: readonly BreadcrumbItemData[] = [
	{ key: "projects", label: "Projects", onPress: ignorePress },
	{ key: "acme", label: "Acme web", onPress: ignorePress },
	{ key: "deployments", label: "Deployments" },
];

export function Breadcrumb12Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<IconButton icon={HomeIcon} label="Home" variant="secondary" size="sm" onPress={ignorePress} />
			<Breadcrumb items={ITEMS} className="flex-1" />
		</View>
	);
}
