import CheckIcon from "lucide-react-native/icons/check";
import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";

export function Badge20Example(): React.JSX.Element {
	return <Badge label="Verified" icon={CheckIcon} variant="outline" />;
}
