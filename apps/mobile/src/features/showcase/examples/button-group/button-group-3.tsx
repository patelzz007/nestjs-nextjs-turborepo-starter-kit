import ArrowUpIcon from "lucide-react-native/icons/arrow-up";
import FileIcon from "lucide-react-native/icons/file";
import PencilIcon from "lucide-react-native/icons/pencil";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup3Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Draft actions" className="self-start">
			<ButtonGroupText label="Draft" icon={FileIcon} />
			<Button label="Edit" variant="outline" icon={PencilIcon} onPress={ignorePress} />
			<IconButton icon={ArrowUpIcon} label="Move up" onPress={ignorePress} className="h-12 w-12" />
		</ButtonGroup>
	);
}
