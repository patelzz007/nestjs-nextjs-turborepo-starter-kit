import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";

import { ignorePress } from "../example-support";

export function PdfViewerDont1Example(): React.JSX.Element {
	return <Button label="Open" size="sm" onPress={ignorePress} className="self-start" />;
}
