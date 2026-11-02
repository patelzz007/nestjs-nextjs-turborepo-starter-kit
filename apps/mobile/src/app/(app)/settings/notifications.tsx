// The inbox (ADR 070): every notice of this app as a feed, with the way to its settings in it.

import * as React from "react";

import { Screen } from "../../../components/screen";
import { NotificationsInbox } from "../../../contexts/notifications";

export default function NotificationsScreen(): React.JSX.Element {
	return (
		<Screen>
			<NotificationsInbox />
		</Screen>
	);
}
