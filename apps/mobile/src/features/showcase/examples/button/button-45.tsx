import MessageSquareIcon from "lucide-react-native/icons/message-square";
import { Badge } from "@workspace/ui-native/components/badge";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button45Example(): React.JSX.Element {
	return (
		<Button
			label="Messages"
			variant="outline"
			icon={MessageSquareIcon}
			accessibilityLabel="Messages, 12"
			trailing={<Badge label="12" variant="outline" size="sm" />}
			onPress={ignorePress}
		/>
	);
}
