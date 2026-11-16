import { Icon } from "@workspace/ui-native/components/icon";
import { IconStack } from "@workspace/ui-native/components/icon-stack";
import InboxIcon from "lucide-react-native/icons/inbox";
import * as React from "react";

// The stack alone, with no words beside it: it is hidden from screen readers, so they hear nothing at all.
export function IconStackDont1Example(): React.JSX.Element {
	return (
		<IconStack tone="primary" className="self-center">
			<Icon icon={InboxIcon} size="sm" colorClassName="accent-primary" />
		</IconStack>
	);
}
