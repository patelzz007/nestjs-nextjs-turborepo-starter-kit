import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input26Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Input value={value} onChange={setValue} variant="filled" placeholder="Search notes" accessibilityLabel="Search notes" />;
}
