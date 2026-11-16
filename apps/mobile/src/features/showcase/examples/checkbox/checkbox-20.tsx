import CircleHelpIcon from "lucide-react-native/icons/circle-help";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { Icon } from "@workspace/ui-native/components/icon";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

export function Checkbox20Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return (
		<Checkbox
			label="Subscribe to the newsletter"
			controlPosition="end"
			trailing={
				<Tooltip content="We send at most one email a month." accessibilityLabel="About the newsletter">
					<Icon icon={CircleHelpIcon} size="sm" colorClassName="accent-icon" />
				</Tooltip>
			}
			checked={checked}
			onChange={setChecked}
		/>
	);
}
