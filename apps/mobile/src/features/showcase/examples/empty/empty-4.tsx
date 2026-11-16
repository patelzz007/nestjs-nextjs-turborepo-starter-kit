import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import { TextLink } from "@workspace/ui-native/components/text-link";
import FolderIcon from "lucide-react-native/icons/folder";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Empty4Example(): React.JSX.Element {
	return (
		<EmptyState variant="outline" align="center" icon={FolderIcon} title="Nothing to see here" message="No posts have been created yet.">
			<TextLink leadIn="Get started by" label="creating your first post" onPress={ignorePress} />
			<Button label="New Post" variant="outline" size="sm" icon={PlusIcon} onPress={ignorePress} />
		</EmptyState>
	);
}
