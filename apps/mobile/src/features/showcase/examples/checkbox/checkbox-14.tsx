import ChartColumnIcon from "lucide-react-native/icons/chart-column";
import ShieldIcon from "lucide-react-native/icons/shield";
import UsersIcon from "lucide-react-native/icons/users";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { type LucideIcon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { View } from "react-native";

interface Module {
	readonly title: string;
	readonly description: string;
	readonly icon: LucideIcon;
}

const MODULES: readonly Module[] = [
	{ title: "Analytics", description: "Dashboards and reports", icon: ChartColumnIcon },
	{ title: "Teams", description: "Members and roles", icon: UsersIcon },
	{ title: "Security", description: "SSO and audit logs", icon: ShieldIcon },
];

function ModuleTile({ title, description, icon }: Module): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return (
		<Checkbox
			variant="card"
			label={title}
			description={description}
			leading={<IconTile icon={icon} tone="blue" size="sm" />}
			controlPosition="end"
			checked={checked}
			onChange={setChecked}
			className="w-full"
		/>
	);
}

export function Checkbox14Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-2">
			{MODULES.map(({ title, description, icon }: Module): React.JSX.Element => (
				<ModuleTile key={title} title={title} description={description} icon={icon} />
			))}
		</View>
	);
}
