import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Button } from "@workspace/ui-native/components/button";

import { ignorePress } from "../example-support";
import { FIRST } from "./avatar-sample";

// A pill outline button whose photo hugs its start.
export function Avatar26Example(): React.JSX.Element {
	return (
		<Button
			label="Sofia Davis"
			variant="outline"
			size="sm"
			leading={<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="sm" />}
			onPress={ignorePress}
			className="self-start rounded-full pl-1"
		/>
	);
}
