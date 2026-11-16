import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button10Example(): React.JSX.Element {
	return <Button label="Button" disabled onPress={ignorePress} />;
}
