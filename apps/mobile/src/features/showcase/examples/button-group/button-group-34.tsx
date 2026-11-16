import BotIcon from "lucide-react-native/icons/bot";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import GitBranchIcon from "lucide-react-native/icons/git-branch";
import RouteIcon from "lucide-react-native/icons/route";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import * as React from "react";

import { ignorePress } from "../example-support";

const MORE: readonly DropdownMenuItemData<string>[] = [
	{ value: "referrers", label: "Referrers" },
	{ value: "countries", label: "Countries" },
];

export function ButtonGroup34Example(): React.JSX.Element {
	const [segment, setSegment] = React.useState<"routes" | "paths" | "bots">("paths");
	const showRoutes = React.useCallback((): void => {
		setSegment("routes");
	}, []);
	const showPaths = React.useCallback((): void => {
		setSegment("paths");
	}, []);
	const showBots = React.useCallback((): void => {
		setSegment("bots");
	}, []);
	return (
		<ButtonGroup accessibilityLabel="Traffic" className="self-start">
			<Button label="Routes" variant={segment === "routes" ? "secondary" : "outline"} icon={RouteIcon} onPress={showRoutes} />
			<Button label="Paths" variant={segment === "paths" ? "secondary" : "outline"} icon={GitBranchIcon} onPress={showPaths} />
			<Button label="Bot name" variant={segment === "bots" ? "secondary" : "outline"} icon={BotIcon} onPress={showBots} />
			<DropdownMenu label="More views" size="icon" icon={ChevronDownIcon} items={MORE} onSelect={ignorePress} />
		</ButtonGroup>
	);
}
