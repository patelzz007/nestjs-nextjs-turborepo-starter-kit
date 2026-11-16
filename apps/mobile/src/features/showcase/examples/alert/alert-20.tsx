import { Avatar } from "@workspace/ui-native/components/avatar";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

const FACE = <Avatar name="Ben Ortiz" imageUrl={null} size="md" />;

export function Alert20Example(): React.JSX.Element {
	return (
		<Alert tone="invert" leading={FACE} title="Ben Ortiz mentioned you" message="in “Q4 planning”: @you can you take the API part?">
			<Button label="View" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
