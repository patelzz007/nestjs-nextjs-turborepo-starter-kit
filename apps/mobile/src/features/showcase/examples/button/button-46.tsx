import { Button } from "@workspace/ui-native/components/button";
import { PulseDot } from "@workspace/ui-native/components/pulse-dot";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button46Example(): React.JSX.Element {
	return <Button label="Live" variant="outline" trailing={<PulseDot tone="success" />} accessibilityLabel="Live, streaming now" onPress={ignorePress} />;
}
