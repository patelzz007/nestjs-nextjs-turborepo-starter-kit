import UserRoundXIcon from "lucide-react-native/icons/user-round-x";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";

const LEADS: readonly ComboboxOption<string>[] = [
	{ value: "none", label: "No lead", leading: <Icon icon={UserRoundXIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{
		value: "avery",
		label: "Avery Chen",
		group: "Team members",
		leading: <Avatar name="Avery Chen" imageUrl={null} size="sm" />,
		trailing: <Badge label="You" size="sm" />,
	},
	{ value: "olivia", label: "Olivia Martin", group: "Team members", leading: <Avatar name="Olivia Martin" imageUrl={null} size="sm" /> },
	{ value: "jackson", label: "Jackson Lee", group: "Team members", leading: <Avatar name="Jackson Lee" imageUrl={null} size="sm" /> },
	{ value: "isabella", label: "Isabella Nguyen", group: "Team members", leading: <Avatar name="Isabella Nguyen" imageUrl={null} size="sm" /> },
];

export function Combobox23Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("avery");
	return <Combobox label="Lead" options={LEADS} value={value} onChange={setValue} searchPlaceholder="Set lead…" />;
}
