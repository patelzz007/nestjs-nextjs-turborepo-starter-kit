import ArrowLeftIcon from "lucide-react-native/icons/arrow-left";
import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup10Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Pages" className="self-start">
			<Button label="Previous" variant="outline" size="sm" icon={ArrowLeftIcon} onPress={ignorePress} />
			<Button label="1" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="2" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="3" variant="outline" size="sm" onPress={ignorePress} />
			<Button label="Next" variant="outline" size="sm" icon={ArrowRightIcon} iconPosition="end" onPress={ignorePress} />
		</ButtonGroup>
	);
}
