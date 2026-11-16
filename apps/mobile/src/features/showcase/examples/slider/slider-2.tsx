import { Slider } from "@workspace/ui-native/components/slider";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Slider2Example(): React.JSX.Element {
	return <Slider value={50} onChange={ignorePress} disabled accessibilityLabel="Value" />;
}
