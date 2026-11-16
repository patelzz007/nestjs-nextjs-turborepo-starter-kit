import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Button } from "@workspace/ui-native/components/button";

import { ignorePress } from "../example-support";
import { FIRST } from "./avatar-sample";

// A solid pill button with the photo ringed against it.
export function Avatar27Example(): React.JSX.Element {
	return (
		<Button
			label="Follow Sofia"
			size="sm"
			leading={<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="sm" ring="primary" />}
			onPress={ignorePress}
			className="self-start rounded-full pl-1"
		/>
	);
}
