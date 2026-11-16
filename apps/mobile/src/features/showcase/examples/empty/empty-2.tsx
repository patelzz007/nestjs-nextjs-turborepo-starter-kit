import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import ArrowUpRightIcon from "lucide-react-native/icons/arrow-up-right";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Empty2Example(): React.JSX.Element {
	return (
		<EmptyState align="center" title="No results found" message="No results found for your search. Try adjusting your search terms.">
			<Button label="Try again" size="sm" onPress={ignorePress} />
			<Button label="Learn more" variant="link" size="sm" icon={ArrowUpRightIcon} iconPosition="end" onPress={ignorePress} />
		</EmptyState>
	);
}
