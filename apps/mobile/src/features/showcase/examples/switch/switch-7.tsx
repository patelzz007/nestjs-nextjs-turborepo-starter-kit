import BellIcon from "lucide-react-native/icons/bell";
import MailIcon from "lucide-react-native/icons/mail";
import PhoneIcon from "lucide-react-native/icons/phone";
import { Card } from "@workspace/ui-native/components/card";
import { Icon } from "@workspace/ui-native/components/icon";
import { Separator } from "@workspace/ui-native/components/separator";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function Switch7Example(): React.JSX.Element {
	const [alerts, setAlerts] = React.useState<boolean>(true);
	const [email, setEmail] = React.useState<boolean>(false);
	const [calls, setCalls] = React.useState<boolean>(true);
	return (
		<Card>
			<Switch label="Alerts" leading={<Icon icon={BellIcon} size="md" colorClassName="accent-icon" />} checked={alerts} onChange={setAlerts} />
			<Separator />
			<Switch label="Email" leading={<Icon icon={MailIcon} size="md" colorClassName="accent-icon" />} checked={email} onChange={setEmail} />
			<Separator />
			<Switch label="Calls" leading={<Icon icon={PhoneIcon} size="md" colorClassName="accent-icon" />} checked={calls} onChange={setCalls} />
		</Card>
	);
}
