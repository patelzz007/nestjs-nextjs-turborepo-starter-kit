import MailIcon from "lucide-react-native/icons/mail";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button34Example(): React.JSX.Element {
	return <Button label="Log in with email" icon={MailIcon} onPress={ignorePress} />;
}
