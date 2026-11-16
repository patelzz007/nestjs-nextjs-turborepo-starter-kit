import CircleDotIcon from "lucide-react-native/icons/circle-dot";
import ClockIcon from "lucide-react-native/icons/clock";
import PlusIcon from "lucide-react-native/icons/plus";
import UsersIcon from "lucide-react-native/icons/users";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup5Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Team activity" className="self-start">
			<Button label="Team" variant="outline" icon={UsersIcon} onPress={ignorePress} />
			<ButtonGroupText label="3 live" icon={CircleDotIcon} />
			<IconButton icon={PlusIcon} label="Invite" onPress={ignorePress} className="h-12 w-12" />
			<IconButton icon={ClockIcon} label="Activity" onPress={ignorePress} className="h-12 w-12" />
		</ButtonGroup>
	);
}
