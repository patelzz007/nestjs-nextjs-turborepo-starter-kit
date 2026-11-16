import MailIcon from "lucide-react-native/icons/mail";
import MessageSquareIcon from "lucide-react-native/icons/message-square";
import PhoneIcon from "lucide-react-native/icons/phone";
import { Card } from "@workspace/ui-native/components/card";
import { Icon } from "@workspace/ui-native/components/icon";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const METHODS: readonly RadioOption<string>[] = [
	{ value: "email", label: "Email", leading: <Icon icon={MailIcon} size="md" colorClassName="accent-icon" /> },
	{ value: "phone", label: "Phone", leading: <Icon icon={PhoneIcon} size="md" colorClassName="accent-icon" /> },
	{ value: "chat", label: "Chat", leading: <Icon icon={MessageSquareIcon} size="md" colorClassName="accent-icon" /> },
];

export function RadioGroup9Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("email");
	return (
		<Card>
			<RadioGroup label="Contact method" options={METHODS} value={value} onChange={setValue} controlPosition="end" />
		</Card>
	);
}
