import FlipHorizontal2Icon from "lucide-react-native/icons/flip-horizontal-2";
import FlipVertical2Icon from "lucide-react-native/icons/flip-vertical-2";
import RotateCwIcon from "lucide-react-native/icons/rotate-cw";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup6Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Transform" className="self-start">
			<IconButton icon={FlipHorizontal2Icon} label="Flip horizontally" onPress={ignorePress} />
			<IconButton icon={FlipVertical2Icon} label="Flip vertically" onPress={ignorePress} />
			<IconButton icon={RotateCwIcon} label="Rotate" onPress={ignorePress} />
		</ButtonGroup>
	);
}
