import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button32Example(): React.JSX.Element {
	return <Button label="Retry" variant="outline" invalid onPress={ignorePress} />;
}
