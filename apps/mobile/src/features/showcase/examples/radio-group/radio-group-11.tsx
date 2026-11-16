import ChartColumnIcon from "lucide-react-native/icons/chart-column";
import SettingsIcon from "lucide-react-native/icons/settings";
import ShieldIcon from "lucide-react-native/icons/shield";
import UsersIcon from "lucide-react-native/icons/users";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const AREAS: readonly RadioOption<string>[] = [
	{ value: "analytics", label: "Analytics", description: "Reports", leading: <IconTile icon={ChartColumnIcon} tone="blue" size="sm" /> },
	{ value: "teams", label: "Teams", description: "Members", leading: <IconTile icon={UsersIcon} tone="green" size="sm" /> },
	{ value: "security", label: "Security", description: "Access", leading: <IconTile icon={ShieldIcon} tone="red" size="sm" /> },
	{ value: "settings", label: "Settings", description: "Workspace", leading: <IconTile icon={SettingsIcon} tone="violet" size="sm" /> },
];

export function RadioGroup11Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("analytics");
	return <RadioGroup label="Area" options={AREAS} value={value} onChange={setValue} variant="card" orientation="grid" />;
}
