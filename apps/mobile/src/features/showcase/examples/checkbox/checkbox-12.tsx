import MailIcon from "lucide-react-native/icons/mail";
import MessageSquareIcon from "lucide-react-native/icons/message-square";
import { Card } from "@workspace/ui-native/components/card";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { Icon } from "@workspace/ui-native/components/icon";
import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";

export function Checkbox12Example(): React.JSX.Element {
	const [email, setEmail] = React.useState<boolean>(true);
	const [sms, setSms] = React.useState<boolean>(false);
	return (
		<Card>
			<Checkbox label="Email" leading={<Icon icon={MailIcon} size="md" colorClassName="accent-icon" />} checked={email} onChange={setEmail} controlPosition="end" />
			<Separator />
			<Checkbox label="SMS" leading={<Icon icon={MessageSquareIcon} size="md" colorClassName="accent-icon" />} checked={sms} onChange={setSms} controlPosition="end" />
		</Card>
	);
}
