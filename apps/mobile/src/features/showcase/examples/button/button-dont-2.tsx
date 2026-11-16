import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonDont2Example(): React.JSX.Element {
	return <Button label="OK" onPress={ignorePress} />;
}
