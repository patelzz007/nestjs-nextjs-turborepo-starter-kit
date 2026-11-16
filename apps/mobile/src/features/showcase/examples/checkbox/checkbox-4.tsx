import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Checkbox4Example(): React.JSX.Element {
	return <Checkbox label="Select all" checked={false} indeterminate onChange={ignorePress} />;
}
