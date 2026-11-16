import PlayIcon from "lucide-react-native/icons/play";
import SkipBackIcon from "lucide-react-native/icons/skip-back";
import SkipForwardIcon from "lucide-react-native/icons/skip-forward";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup38Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Playback" className="self-start">
			<IconButton icon={SkipBackIcon} label="Previous track" onPress={ignorePress} />
			<IconButton icon={PlayIcon} label="Play" onPress={ignorePress} />
			<IconButton icon={SkipForwardIcon} label="Next track" onPress={ignorePress} />
		</ButtonGroup>
	);
}
