import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup2Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<string>("");
	return (
		<ButtonGroup accessibilityLabel="Search">
			<Button label="Search" variant="outline" onPress={ignorePress} />
			<Input value={query} onChange={setQuery} placeholder="Type to search…" accessibilityLabel="Search" className="flex-1" />
		</ButtonGroup>
	);
}
