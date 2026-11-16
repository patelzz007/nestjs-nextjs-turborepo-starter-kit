import { EmptyState } from "@workspace/ui-native/components/empty";
import BellOffIcon from "lucide-react-native/icons/bell-off";
import * as React from "react";

export function Empty9Example(): React.JSX.Element {
	return <EmptyState align="center" icon={BellOffIcon} title="No notifications" message="When you get notifications, they'll show up here." className="py-16" />;
}
