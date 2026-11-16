import BellIcon from "lucide-react-native/icons/bell";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button25Example(): React.JSX.Element {
	return <IconButton icon={BellIcon} label="Notifications" variant="ghost" size="sm" onPress={ignorePress} />;
}
