import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button4Example(): React.JSX.Element {
	return <Button label="Ghost" variant="ghost" onPress={ignorePress} />;
}
