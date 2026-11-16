import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import SearchIcon from "lucide-react-native/icons/search";
import * as React from "react";

import { ignorePress } from "../example-support";

export function EmptyDo2Example(): React.JSX.Element {
	return (
		<EmptyState align="center" icon={SearchIcon} title="No results for “invioce”" message="Check the spelling, or search for something else.">
			<Button label="Clear search" variant="outline" size="sm" onPress={ignorePress} />
		</EmptyState>
	);
}
