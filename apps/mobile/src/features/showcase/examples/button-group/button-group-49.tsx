import LayoutGridIcon from "lucide-react-native/icons/layout-grid";
import ListIcon from "lucide-react-native/icons/list";
import SettingsIcon from "lucide-react-native/icons/settings";
import UsersIcon from "lucide-react-native/icons/users";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { type LucideIcon } from "@workspace/ui-native/components/icon";
import * as React from "react";

interface NavLink {
	readonly label: string;
	readonly icon: LucideIcon;
}

const LINKS: readonly NavLink[] = [
	{ label: "Overview", icon: LayoutGridIcon },
	{ label: "Tasks", icon: ListIcon },
	{ label: "Team", icon: UsersIcon },
	{ label: "Settings", icon: SettingsIcon },
];

interface NavButtonProps extends NavLink {
	readonly current: boolean;
	readonly onPick: (label: string) => void;
}

function NavButton({ label, icon, current, onPick }: NavButtonProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(label);
	}, [label, onPick]);
	return (
		<Button
			label={label}
			icon={icon}
			variant={current ? "secondary" : "ghost"}
			accessibilityLabel={current ? `${label}, current` : label}
			onPress={press}
			className="justify-start"
		/>
	);
}

export function ButtonGroup49Example(): React.JSX.Element {
	const [current, setCurrent] = React.useState<string>("Overview");
	return (
		<ButtonGroup orientation="vertical" accessibilityLabel="Navigation" className="self-stretch">
			{LINKS.map(({ label, icon }: NavLink): React.JSX.Element => (
				<NavButton key={label} label={label} icon={icon} current={current === label} onPick={setCurrent} />
			))}
		</ButtonGroup>
	);
}
