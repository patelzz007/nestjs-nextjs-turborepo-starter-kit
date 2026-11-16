import StarIcon from "lucide-react-native/icons/star";
import { Button } from "@workspace/ui-native/components/button";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function ButtonGroup30Example(): React.JSX.Element {
	return (
		<ButtonGroup accessibilityLabel="Star, 2.4k stars" className="self-start">
			<Button label="Star" icon={StarIcon} onPress={ignorePress} />
			<ButtonGroupText label="2.4k" variant="primary" />
		</ButtonGroup>
	);
}
