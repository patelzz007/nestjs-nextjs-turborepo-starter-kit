import { Badge } from "@workspace/ui-native/components/badge";
import { useRouter } from "expo-router";
import * as React from "react";

export function Badge23Example(): React.JSX.Element {
	const router = useRouter();
	const open = React.useCallback((): void => {
		router.navigate("/settings");
	}, [router]);
	return <Badge label="Settings" variant="outline" onPress={open} />;
}
