import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button8Example(): React.JSX.Element {
	return <Button label="Small" size="sm" onPress={ignorePress} />;
}
