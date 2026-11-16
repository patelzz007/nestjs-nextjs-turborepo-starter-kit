import CircleHelpIcon from "lucide-react-native/icons/circle-help";
import { Icon } from "@workspace/ui-native/components/icon";
import { Switch } from "@workspace/ui-native/components/switch";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

export function Switch9Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return (
		<Switch
			label="Two-step sign-in"
			trailing={
				<Tooltip content="Asks for a code from your phone at every sign-in." accessibilityLabel="About two-step sign-in">
					<Icon icon={CircleHelpIcon} size="sm" colorClassName="accent-icon" />
				</Tooltip>
			}
			checked={checked}
			onChange={setChecked}
		/>
	);
}
