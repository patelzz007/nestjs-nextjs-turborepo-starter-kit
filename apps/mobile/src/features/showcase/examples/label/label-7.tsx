import InfoIcon from "lucide-react-native/icons/info";
import { Field } from "@workspace/ui-native/components/field";
import { Icon } from "@workspace/ui-native/components/icon";
import { Input } from "@workspace/ui-native/components/input";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

export function Label7Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field
			label="API key"
			labelTrailing={
				<Tooltip content="Find it under Settings → Developers." accessibilityLabel="About the API key">
					<Icon icon={InfoIcon} size="sm" colorClassName="accent-icon" />
				</Tooltip>
			}>
			<Input value={value} onChange={setValue} autoCapitalize="none" />
		</Field>
	);
}
