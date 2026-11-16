import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { useRouter } from "expo-router";

export function Button49Example(): React.JSX.Element {
	const router = useRouter();
	const goBack = React.useCallback((): void => {
		if (router.canGoBack()) {
			router.back();
		}
	}, [router]);
	return <Button label="Go back" variant="link" icon={ChevronLeftIcon} onPress={goBack} />;
}
