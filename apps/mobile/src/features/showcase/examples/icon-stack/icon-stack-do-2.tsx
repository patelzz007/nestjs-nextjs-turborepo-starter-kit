import { Icon } from "@workspace/ui-native/components/icon";
import { IconStack } from "@workspace/ui-native/components/icon-stack";
import PackageIcon from "lucide-react-native/icons/package";
import * as React from "react";

export function IconStackDo2Example(): React.JSX.Element {
	return (
		<IconStack tone="primary" className="self-center">
			<Icon icon={PackageIcon} size="sm" colorClassName="accent-primary" />
		</IconStack>
	);
}
