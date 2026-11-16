import { Field } from "@workspace/ui-native/components/field";
import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Textarea5Example(): React.JSX.Element {
	return (
		<Field label="Notes" disabled>
			<Textarea value="Locked while the order ships." onChange={ignorePress} />
		</Field>
	);
}
