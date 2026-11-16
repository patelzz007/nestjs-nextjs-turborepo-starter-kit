import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

import { ignorePress } from "../example-support";

const DENSITY: readonly RadioOption<string>[] = [
	{ value: "default", label: "Default" },
	{ value: "comfortable", label: "Comfortable" },
	{ value: "compact", label: "Compact" },
];

export function RadioGroup2Example(): React.JSX.Element {
	return <RadioGroup label="Density" options={DENSITY} value="comfortable" onChange={ignorePress} disabled />;
}
