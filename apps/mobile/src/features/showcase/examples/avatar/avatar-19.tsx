import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Button } from "@workspace/ui-native/components/button";

import { ignorePress } from "../example-support";
import { FIRST } from "./avatar-sample";

// A small photo beside an @handle inside a small outline button.
export function Avatar19Example(): React.JSX.Element {
	return (
		<Button label="@sofia" variant="outline" size="sm" leading={<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="xs" />} onPress={ignorePress} className="self-start" />
	);
}
