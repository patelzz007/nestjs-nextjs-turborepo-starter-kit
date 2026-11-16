import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function Input24Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const [focused, setFocused] = React.useState<boolean>(false);
	const focus = React.useCallback((): void => {
		setFocused(true);
	}, []);
	const blur = React.useCallback((): void => {
		setFocused(false);
	}, []);
	return (
		<Input
			value={value}
			onChange={setValue}
			onFocus={focus}
			onBlur={blur}
			variant="filled"
			placeholder="Start typing…"
			accessibilityLabel="Note"
			className={focused ? undefined : "bg-primary-subtle"}
		/>
	);
}
