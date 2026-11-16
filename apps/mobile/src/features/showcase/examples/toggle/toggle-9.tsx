import HeartIcon from "lucide-react-native/icons/heart";
import HeartPlusIcon from "lucide-react-native/icons/heart-plus";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";

export function Toggle9Example(): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(false);
	return <Toggle label="Like" icon={HeartIcon} pressedIcon={HeartPlusIcon} hideLabel pressed={pressed} onChange={setPressed} className="self-start" />;
}
