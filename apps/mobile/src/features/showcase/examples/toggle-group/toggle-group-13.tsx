import HashIcon from "lucide-react-native/icons/hash";
import MailIcon from "lucide-react-native/icons/mail";
import MessageSquareTextIcon from "lucide-react-native/icons/message-square-text";
import SmartphoneIcon from "lucide-react-native/icons/smartphone";
import { ToggleGroup, type ToggleGroupOption } from "@workspace/ui-native/components/toggle-group";
import * as React from "react";

const CHANNELS: readonly ToggleGroupOption<string>[] = [
	{ value: "email", label: "Email", icon: MailIcon },
	{ value: "sms", label: "SMS", icon: MessageSquareTextIcon },
	{ value: "push", label: "Push", icon: SmartphoneIcon },
	{ value: "slack", label: "Slack", icon: HashIcon },
];

export function ToggleGroup13Example(): React.JSX.Element {
	const [value, setValue] = React.useState<readonly string[]>(["email", "push"]);
	return <ToggleGroup type="multiple" label="Notify me by" options={CHANNELS} value={value} onChange={setValue} variant="outline" />;
}
