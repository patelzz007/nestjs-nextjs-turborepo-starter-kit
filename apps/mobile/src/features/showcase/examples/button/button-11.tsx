import SearchIcon from "lucide-react-native/icons/search";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button11Example(): React.JSX.Element {
	return <IconButton icon={SearchIcon} label="Search" onPress={ignorePress} />;
}
