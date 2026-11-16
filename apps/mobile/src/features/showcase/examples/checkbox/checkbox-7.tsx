import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

export function Checkbox7Example(): React.JSX.Element {
	const [done, setDone] = React.useState<boolean>(false);
	return <Checkbox label="Write the release notes" shape="round" strikeWhenChecked checked={done} onChange={setDone} />;
}
