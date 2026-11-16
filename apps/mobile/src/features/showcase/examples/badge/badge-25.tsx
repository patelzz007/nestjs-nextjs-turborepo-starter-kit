import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";
import { Text } from "react-native";

const FLAG = <Text className="text-body">🇩🇪</Text>;

export function Badge25Example(): React.JSX.Element {
	return <Badge label="Germany" variant="outline" leading={FLAG} />;
}
