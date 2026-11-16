import { EmptyState } from "@workspace/ui-native/components/empty";
import { Icon } from "@workspace/ui-native/components/icon";
import { IconStack } from "@workspace/ui-native/components/icon-stack";
import InboxIcon from "lucide-react-native/icons/inbox";
import * as React from "react";

const ILLUSTRATION = (
	<IconStack tone="primary">
		<Icon icon={InboxIcon} size="sm" colorClassName="accent-primary" />
	</IconStack>
);

export function IconStackDo1Example(): React.JSX.Element {
	return <EmptyState variant="plain" align="center" illustration={ILLUSTRATION} title="No messages" message="New messages land here." />;
}
