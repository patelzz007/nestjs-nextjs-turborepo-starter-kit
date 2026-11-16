import CircleHelpIcon from "lucide-react-native/icons/circle-help";
import { Field } from "@workspace/ui-native/components/field";
import { Icon } from "@workspace/ui-native/components/icon";
import { Input } from "@workspace/ui-native/components/input";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

export function Input16Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field
			label="Username"
			hint="3–20 letters, digits or dashes."
			labelTrailing={
				<Tooltip content="Shown on your public profile." accessibilityLabel="About the username">
					<Icon icon={CircleHelpIcon} size="sm" colorClassName="accent-icon" />
				</Tooltip>
			}>
			<Input value={value} onChange={setValue} autoCapitalize="none" />
		</Field>
	);
}
