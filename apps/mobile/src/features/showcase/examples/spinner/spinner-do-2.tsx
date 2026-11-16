import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

// A busy button: `loading` draws its spinner and holds the action until the work ends.
export function SpinnerDo2Example(): React.JSX.Element {
	return <Button label="Saving…" loading onPress={ignorePress} />;
}
