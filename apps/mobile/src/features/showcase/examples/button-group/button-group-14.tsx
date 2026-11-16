import CopyIcon from "lucide-react-native/icons/copy";
import SearchIcon from "lucide-react-native/icons/search";
import Share2Icon from "lucide-react-native/icons/share-2";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup14Example(): React.JSX.Element {
	return (
		<ButtonGroup orientation="vertical" variant="separated" accessibilityLabel="Tools" className="self-start">
			<ButtonGroup orientation="vertical" accessibilityLabel="Edit tools">
				<IconButton icon={SearchIcon} label="Search" onPress={ignorePress} />
				<IconButton icon={CopyIcon} label="Copy" onPress={ignorePress} />
				<IconButton icon={Share2Icon} label="Share" onPress={ignorePress} />
			</ButtonGroup>
			<IconButton icon={Trash2Icon} label="Delete" onPress={ignorePress} />
		</ButtonGroup>
	);
}
