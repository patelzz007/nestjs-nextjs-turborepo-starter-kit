import UserPlusIcon from "lucide-react-native/icons/user-plus";
import UserRoundXIcon from "lucide-react-native/icons/user-round-x";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { Text, View } from "react-native";

/** The row that invites someone new instead of choosing an assignee. */
const INVITE = "invite";

const ASSIGNEES: readonly ComboboxOption<string>[] = [
	{ value: "none", label: "No assignee", leading: <Icon icon={UserRoundXIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "olivia", label: "Olivia Martin", leading: <Avatar name="Olivia Martin" imageUrl={null} size="sm" /> },
	{ value: "jackson", label: "Jackson Lee", leading: <Avatar name="Jackson Lee" imageUrl={null} size="sm" /> },
	{ value: "isabella", label: "Isabella Nguyen", leading: <Avatar name="Isabella Nguyen" imageUrl={null} size="sm" /> },
	{ value: INVITE, label: "Invite and assign…", group: "New user", leading: <Icon icon={UserPlusIcon} size="sm" colorClassName="accent-primary" /> },
];

export function Combobox28Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("none");
	const [invited, setInvited] = React.useState(false);
	const choose = React.useCallback((next: string): void => {
		if (next === INVITE) {
			setInvited(true);
			return;
		}
		setValue(next);
	}, []);
	return (
		<View className="gap-2">
			<Combobox label="Assignee" options={ASSIGNEES} value={value} onChange={choose} searchPlaceholder="Assign to…" />
			{invited ? <Text className="text-body font-sans text-muted-foreground">An invitation link was copied.</Text> : null}
		</View>
	);
}
