import { EmptyState } from "@workspace/ui-native/components/empty";
import InboxIcon from "lucide-react-native/icons/inbox";
import * as React from "react";

export function Empty7Example(): React.JSX.Element {
	return <EmptyState variant="plain" align="center" icon={InboxIcon} title="Inbox zero" message="You're all caught up. No new messages." className="py-16" />;
}
