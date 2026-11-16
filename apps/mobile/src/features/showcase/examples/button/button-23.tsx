import CircleAlertIcon from "lucide-react-native/icons/circle-alert";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button23Example(): React.JSX.Element {
	return <Button label="Confirm removal" variant="destructive" icon={CircleAlertIcon} iconPosition="end" onPress={ignorePress} />;
}
