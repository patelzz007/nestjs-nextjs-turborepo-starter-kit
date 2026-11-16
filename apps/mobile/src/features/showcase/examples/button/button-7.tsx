import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button7Example(): React.JSX.Element {
	return <Button label="Extra small" size="xs" onPress={ignorePress} />;
}
