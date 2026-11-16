import PlayIcon from "lucide-react-native/icons/play";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button26Example(): React.JSX.Element {
	return <IconButton icon={PlayIcon} label="Play" variant="primary" size="lg" onPress={ignorePress} />;
}
