import InfoIcon from "lucide-react-native/icons/info";
import { Icon } from "@workspace/ui-native/components/icon";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

export function InputGroup14Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("60");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			keyboardType="number-pad"
			accessibilityLabel="Request limit"
			trailing={
				<Tooltip content="Requests a key may make each minute." accessibilityLabel="About the limit">
					<Icon icon={InfoIcon} size="sm" colorClassName="accent-icon" />
				</Tooltip>
			}
		/>
	);
}
