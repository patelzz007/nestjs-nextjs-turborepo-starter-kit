import { Icon } from "@workspace/ui-native/components/icon";
import { IconStack } from "@workspace/ui-native/components/icon-stack";
import LayersIcon from "lucide-react-native/icons/layers";
import * as React from "react";

export function IconStack1Example(): React.JSX.Element {
	return (
		<IconStack className="self-center">
			<Icon icon={LayersIcon} size="sm" colorClassName="accent-muted-foreground" />
		</IconStack>
	);
}
