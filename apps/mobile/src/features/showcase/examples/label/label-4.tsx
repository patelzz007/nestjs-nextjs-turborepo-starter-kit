import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Label4Example(): React.JSX.Element {
	return (
		<Field label="Email" disabled>
			<Input value="avery@acme.com" onChange={ignorePress} />
		</Field>
	);
}
