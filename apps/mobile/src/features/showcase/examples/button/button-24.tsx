import XIcon from "lucide-react-native/icons/x";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button24Example(): React.JSX.Element {
	return <IconButton icon={XIcon} label="Dismiss" size="xs" onPress={ignorePress} />;
}
