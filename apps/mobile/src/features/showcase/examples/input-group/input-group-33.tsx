import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function InputGroup33Example(): React.JSX.Element {
	const [name, setName] = React.useState<string>("");
	return (
		<InputGroup
			value={name}
			onChange={setName}
			placeholder="Project name"
			accessibilityLabel="Project name"
			footer={
				<>
					<Badge label="Draft" size="sm" />
					<Button label="Discard" variant="ghost" size="sm" onPress={ignorePress} className="ml-auto" />
					<Button label="Create" size="sm" onPress={ignorePress} />
				</>
			}
		/>
	);
}
