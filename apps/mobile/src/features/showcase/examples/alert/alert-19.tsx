import { Avatar } from "@workspace/ui-native/components/avatar";
import { Alert } from "@workspace/ui-native/components/alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

const FACE = <Avatar name="Ava Patel" imageUrl={null} size="md" />;

export function Alert19Example(): React.JSX.Element {
	return (
		<Alert tone="neutral" leading={FACE} title="Ava Patel" message="“Can you review the launch plan before 3pm?”">
			<Button label="View" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Reply" size="sm" onPress={ignorePress} />
		</Alert>
	);
}
