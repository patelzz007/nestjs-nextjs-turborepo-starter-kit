import { Input } from "@workspace/ui-native/components/input";
import { Kbd } from "@workspace/ui-native/components/kbd";
import * as React from "react";

export function Kbd4Example(): React.JSX.Element {
	const [query, setQuery] = React.useState<string>("");
	return (
		<Input
			value={query}
			onChange={setQuery}
			placeholder="Search…"
			accessibilityLabel="Search"
			accessibilityHint="Space focuses the search on a keyboard"
			leading={<Kbd label="Space" />}
		/>
	);
}
