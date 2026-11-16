import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function FieldDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Input value={value} onChange={setValue} placeholder="Email" accessibilityLabel="Email" />;
}
