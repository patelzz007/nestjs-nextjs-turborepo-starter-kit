import FileIcon from "lucide-react-native/icons/file";
import FolderPlusIcon from "lucide-react-native/icons/folder-plus";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup22Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Storage" className="self-start">
			<Button label="Files" variant="outline" icon={FileIcon} onPress={ignorePress} />
			<Button label="Folder" variant="outline" icon={FolderPlusIcon} disabled onPress={ignorePress} />
			<Button label="Trash" variant="outline" icon={Trash2Icon} onPress={ignorePress} />
		</ButtonGroup>
	);
}
