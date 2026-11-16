import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { useRouter } from "expo-router";

export function Button27Example(): React.JSX.Element {
	const router = useRouter();
	const goHome = React.useCallback((): void => {
		router.navigate("/");
	}, [router]);
	return <Button label="Home" onPress={goHome} />;
}
