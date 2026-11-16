import { Field } from "@workspace/ui-native/components/field";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";

const SEARCHING = <Spinner variant="muted" accessibilityLabel="Searching" />;

export function Spinner4Example(): React.JSX.Element {
	const [query, setQuery] = React.useState("");
	return (
		<Field label="Searching">
			<InputGroup value={query} onChange={setQuery} leading={SEARCHING} placeholder="Search records…" />
		</Field>
	);
}
