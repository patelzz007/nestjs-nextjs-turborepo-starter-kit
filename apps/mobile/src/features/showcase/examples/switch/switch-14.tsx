import CloudIcon from "lucide-react-native/icons/cloud";
import DatabaseIcon from "lucide-react-native/icons/database";
import ShieldIcon from "lucide-react-native/icons/shield";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Switch } from "@workspace/ui-native/components/switch";
import { type LucideIcon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { View } from "react-native";

interface Service {
	readonly name: string;
	readonly description: string;
	readonly icon: LucideIcon;
}

const SERVICES: readonly Service[] = [
	{ name: "Backups", description: "Nightly snapshots", icon: DatabaseIcon },
	{ name: "Sync", description: "Across devices", icon: CloudIcon },
	{ name: "Firewall", description: "Blocks bad traffic", icon: ShieldIcon },
];

function ServiceTile({ name, description, icon }: Service): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return (
		<Switch variant="card" label={name} description={description} leading={<IconTile icon={icon} size="sm" />} checked={checked} onChange={setChecked} className="w-full" />
	);
}

export function Switch14Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-2">
			{SERVICES.map(({ name, description, icon }: Service): React.JSX.Element => (
				<ServiceTile key={name} name={name} description={description} icon={icon} />
			))}
		</View>
	);
}
