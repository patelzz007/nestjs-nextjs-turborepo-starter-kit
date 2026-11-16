import CloudDownloadIcon from "lucide-react-native/icons/cloud-download";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Button14Example(): React.JSX.Element {
	return <Button label="Download" icon={CloudDownloadIcon} onPress={ignorePress} />;
}
