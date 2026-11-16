import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button12Example(): React.JSX.Element {
	return <Button label="Get started" icon={ArrowRightIcon} iconPosition="end" onPress={ignorePress} />;
}
