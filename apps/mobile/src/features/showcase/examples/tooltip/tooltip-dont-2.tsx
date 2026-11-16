import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function TooltipDont2Example(): React.JSX.Element {
	return <Button label="Delete project" variant="destructive" disabled onPress={ignorePress} className="self-start" />;
}
