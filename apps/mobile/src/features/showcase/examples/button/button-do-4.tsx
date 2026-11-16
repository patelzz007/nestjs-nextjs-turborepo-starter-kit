import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonDo4Example(): React.JSX.Element {
	return <Button label="Saving…" loading onPress={ignorePress} />;
}
