import ActivityIcon from "lucide-react-native/icons/activity";
import LayoutDashboardIcon from "lucide-react-native/icons/layout-dashboard";
import SettingsIcon from "lucide-react-native/icons/settings";
import ShieldIcon from "lucide-react-native/icons/shield";
import { Icon } from "@workspace/ui-native/components/icon";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const SECTIONS: readonly SelectOption<string>[] = [
	{ value: "dashboard", label: "Dashboard", leading: <Icon icon={LayoutDashboardIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "activity", label: "Activity", leading: <Icon icon={ActivityIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "security", label: "Security", leading: <Icon icon={ShieldIcon} size="sm" colorClassName="accent-muted-foreground" /> },
	{ value: "settings", label: "Settings", leading: <Icon icon={SettingsIcon} size="sm" colorClassName="accent-muted-foreground" /> },
];

export function Select2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <SelectField label="Section" options={SECTIONS} value={value} onChange={setValue} placeholder="Select a section" />;
}
