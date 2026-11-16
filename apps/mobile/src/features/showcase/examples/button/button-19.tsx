import SlidersHorizontalIcon from "lucide-react-native/icons/sliders-horizontal";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button19Example(): React.JSX.Element {
	return <Button label="Options" variant="outline" icon={SlidersHorizontalIcon} iconPosition="end" onPress={ignorePress} />;
}
