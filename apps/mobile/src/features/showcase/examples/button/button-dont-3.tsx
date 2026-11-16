import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonDont3Example(): React.JSX.Element {
	return <Button label="Cancel" variant="destructive" onPress={ignorePress} />;
}
