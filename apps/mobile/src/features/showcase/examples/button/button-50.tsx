import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { useRouter } from "expo-router";
import { Pressable, type PressableStateCallbackType, Text } from "react-native";

export function Button50Example(): React.JSX.Element {
	const router = useRouter();
	const goBack = React.useCallback((): void => {
		if (router.canGoBack()) {
			router.back();
		}
	}, [router]);
	return (
		<Pressable accessibilityRole="link" accessibilityLabel="Go back" onPress={goBack} className="min-h-11 flex-row items-center gap-1 self-start">
			{({ pressed }: PressableStateCallbackType): React.JSX.Element => (
				<>
					<Icon icon={ChevronLeftIcon} size="sm" colorClassName="accent-link" className={pressed ? "-translate-x-1" : undefined} />
					<Text className="text-body font-button text-link">Go back</Text>
				</>
			)}
		</Pressable>
	);
}
