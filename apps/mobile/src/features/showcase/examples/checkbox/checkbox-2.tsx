import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Checkbox2Example(): React.JSX.Element {
	return <Checkbox label="Remember me" checked disabled onChange={ignorePress} />;
}
