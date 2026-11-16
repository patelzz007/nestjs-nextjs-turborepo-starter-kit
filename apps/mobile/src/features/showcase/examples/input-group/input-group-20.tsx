import SearchIcon from "lucide-react-native/icons/search";
import { Field } from "@workspace/ui-native/components/field";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup20Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Search components">
			<InputGroup value={value} onChange={setValue} leadingIcon={SearchIcon} placeholder="Button, card…" />
		</Field>
	);
}
