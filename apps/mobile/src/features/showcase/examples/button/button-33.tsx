import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button33Example(): React.JSX.Element {
	return <Button label="Retry" variant="ghost" invalid onPress={ignorePress} />;
}
