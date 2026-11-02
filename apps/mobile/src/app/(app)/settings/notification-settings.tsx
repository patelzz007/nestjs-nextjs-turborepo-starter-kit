// Notification settings (ADR 070, 073): channels per kind of message, quiet hours, offers, this phone.

import * as React from "react";

import { Screen } from "../../../components/screen";
import { NotificationSettingsBody } from "../../../contexts/notifications";

export default function NotificationSettingsScreen(): React.JSX.Element {
	return (
		<Screen>
			<NotificationSettingsBody />
		</Screen>
	);
}
