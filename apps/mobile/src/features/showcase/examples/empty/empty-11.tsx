import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import BookmarkIcon from "lucide-react-native/icons/bookmark";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Empty11Example(): React.JSX.Element {
	return (
		<EmptyState variant="plain" align="center" icon={BookmarkIcon} title="No bookmarks" message="Items you bookmark will be saved here for quick access." className="py-16">
			<Button label="Browse Items" variant="outline" size="sm" onPress={ignorePress} />
		</EmptyState>
	);
}
