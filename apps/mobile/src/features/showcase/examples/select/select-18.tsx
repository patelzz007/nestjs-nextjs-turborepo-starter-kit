import { Avatar } from "@workspace/ui-native/components/avatar";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const USERS: readonly SelectOption<string>[] = [
	{ value: "alex", label: "Alex Johnson", description: "alex@example.com", group: "Users", leading: <Avatar name="Alex Johnson" imageUrl={null} size="sm" /> },
	{ value: "sarah", label: "Sarah Chen", description: "sarah@example.com", group: "Users", leading: <Avatar name="Sarah Chen" imageUrl={null} size="sm" /> },
	{ value: "michael", label: "Michael Brown", description: "michael@example.com", group: "Users", leading: <Avatar name="Michael Brown" imageUrl={null} size="sm" /> },
	{ value: "emily", label: "Emily Davis", description: "emily@example.com", group: "Users", leading: <Avatar name="Emily Davis" imageUrl={null} size="sm" /> },
	{ value: "david", label: "David Wilson", description: "david@example.com", group: "Users", leading: <Avatar name="David Wilson" imageUrl={null} size="sm" /> },
	{ value: "lisa", label: "Lisa Anderson", description: "lisa@example.com", group: "Users", leading: <Avatar name="Lisa Anderson" imageUrl={null} size="sm" /> },
	{ value: "james", label: "James Taylor", description: "james@example.com", group: "Users", leading: <Avatar name="James Taylor" imageUrl={null} size="sm" /> },
	{ value: "maria", label: "Maria Garcia", description: "maria@example.com", group: "Users", leading: <Avatar name="Maria Garcia" imageUrl={null} size="sm" /> },
	{ value: "robert", label: "Robert Martinez", description: "robert@example.com", group: "Users", leading: <Avatar name="Robert Martinez" imageUrl={null} size="sm" /> },
	{ value: "jennifer", label: "Jennifer Lee", description: "jennifer@example.com", group: "Users", leading: <Avatar name="Jennifer Lee" imageUrl={null} size="sm" /> },
];

export function Select18Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("alex");
	return <SelectField label="User" options={USERS} value={value} onChange={setValue} />;
}
