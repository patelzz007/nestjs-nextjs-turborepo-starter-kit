import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button13Example(): React.JSX.Element {
	return <Button label="Please wait" loading onPress={ignorePress} />;
}
