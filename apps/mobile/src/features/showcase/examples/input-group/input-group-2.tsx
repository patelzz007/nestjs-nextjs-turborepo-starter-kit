import SearchIcon from "lucide-react-native/icons/search";
import { Field } from "@workspace/ui-native/components/field";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function InputGroup2Example(): React.JSX.Element {
	return (
		<Field label="Search" disabled>
			<InputGroup value="" onChange={ignorePress} leadingIcon={SearchIcon} placeholder="Search…" />
		</Field>
	);
}
