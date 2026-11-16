import ShieldCheckIcon from "lucide-react-native/icons/shield-check";
import { Icon } from "@workspace/ui-native/components/icon";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

export function InputGroup22Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("https://acme.com/billing");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			editable={false}
			accessibilityLabel="Address"
			leading={
				<Tooltip content="Secure connection: the certificate is valid." accessibilityLabel="Secure connection">
					<Icon icon={ShieldCheckIcon} size="sm" colorClassName="accent-success" />
				</Tooltip>
			}
		/>
	);
}
