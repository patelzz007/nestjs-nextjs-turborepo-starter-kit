import { Button } from "@workspace/ui-native/components/button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function InputGroup26Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			multiline
			placeholder="Add a comment…"
			accessibilityLabel="Comment"
			footer={
				<>
					<Button label="Cancel" variant="ghost" size="sm" onPress={ignorePress} />
					<Button label="Post comment" size="sm" onPress={ignorePress} className="ml-auto" />
				</>
			}
		/>
	);
}
