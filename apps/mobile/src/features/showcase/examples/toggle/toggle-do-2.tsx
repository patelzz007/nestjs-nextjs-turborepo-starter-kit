import PinIcon from "lucide-react-native/icons/pin";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";

export function ToggleDo2Example(): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(false);
	return <Toggle label="Pin" icon={PinIcon} variant="outline" pressed={pressed} onChange={setPressed} className="self-start" />;
}
