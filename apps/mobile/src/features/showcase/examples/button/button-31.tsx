import SendIcon from "lucide-react-native/icons/send";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button31Example(): React.JSX.Element {
	return <Button label="Send message" size="lg" icon={SendIcon} iconPosition="end" onPress={ignorePress} />;
}
