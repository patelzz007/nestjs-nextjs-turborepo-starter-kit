import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import FolderIcon from "lucide-react-native/icons/folder";
import * as React from "react";

import { ignorePress } from "../example-support";

// A search that found nothing, shown as if nothing had ever been made.

export function EmptyDont2Example(): React.JSX.Element {
	return (
		<EmptyState align="center" icon={FolderIcon} title="No projects yet" message="Create a project to start tracking your work.">
			<Button label="Create project" size="sm" onPress={ignorePress} />
		</EmptyState>
	);
}
