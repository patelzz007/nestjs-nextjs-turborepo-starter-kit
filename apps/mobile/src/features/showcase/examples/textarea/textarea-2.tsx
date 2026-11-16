import { Textarea } from "@workspace/ui-native/components/textarea";
import * as React from "react";

export function Textarea2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Textarea value={value} onChange={setValue} invalid accessibilityLabel="Message" />;
}
