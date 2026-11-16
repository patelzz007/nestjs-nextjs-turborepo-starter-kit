import PinIcon from "lucide-react-native/icons/pin";
import { Toggle } from "@workspace/ui-native/components/toggle";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";

export function Toggle12Example(): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(false);
	return (
		<Tooltip content="Pin to sidebar" accessibilityLabel="Pin to sidebar" asChild className="self-start">
			<Toggle label="Pin to sidebar" icon={PinIcon} hideLabel variant="outline" pressed={pressed} onChange={setPressed} />
		</Tooltip>
	);
}
