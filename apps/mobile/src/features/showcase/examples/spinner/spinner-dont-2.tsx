import { Button } from "@workspace/ui-native/components/button";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";

import { ignorePress } from "../example-support";

// A spinner on a button that still offers its action: was it pressed or not?
const BUSY = <Spinner colorClassName="accent-primary-foreground" />;

export function SpinnerDont2Example(): React.JSX.Element {
	return <Button label="Save" leading={BUSY} onPress={ignorePress} />;
}
