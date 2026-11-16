import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";

import { FIRST } from "./avatar-sample";

// Two badges on one photo: a presence dot and a red unread count.
export function Avatar34Example(): React.JSX.Element {
	return (
		<Avatar
			name={FIRST.name}
			imageUrl={FIRST.photo}
			badges={[
				{ label: "Online", color: "success" },
				{ label: "3 unread messages", count: 3, color: "destructive", position: "top-right" },
			]}
		/>
	);
}
