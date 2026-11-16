import ExternalLinkIcon from "lucide-react-native/icons/external-link";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button17Example(): React.JSX.Element {
	return <Button label="Open project" variant="secondary" icon={ExternalLinkIcon} iconPosition="end" onPress={ignorePress} />;
}
