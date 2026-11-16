import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonDo2Example(): React.JSX.Element {
	return <Button label="Save changes" onPress={ignorePress} />;
}
