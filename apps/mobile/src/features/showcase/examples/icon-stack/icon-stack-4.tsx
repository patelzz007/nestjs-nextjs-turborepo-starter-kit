import { Icon } from "@workspace/ui-native/components/icon";
import { IconStack } from "@workspace/ui-native/components/icon-stack";
import CheckIcon from "lucide-react-native/icons/check";
import * as React from "react";
import { View } from "react-native";

// A round chip with a check in place of a bare glyph, on a larger primary stack.
export function IconStack4Example(): React.JSX.Element {
	return (
		<IconStack tone="primary" size="lg" className="self-center">
			<View className="size-8 items-center justify-center rounded-full border border-border bg-background shadow-xs">
				<Icon icon={CheckIcon} size="sm" colorClassName="accent-primary" />
			</View>
		</IconStack>
	);
}
