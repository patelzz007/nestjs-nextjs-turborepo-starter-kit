// The expo-blur boundary under Jest (jest.setup.ts mocks "expo-blur" with this
// module). The blur is a native view with no JavaScript implementation, so
// both views become plain React Native views: they keep their refs (Reanimated
// animates `intensity` through one), children, test ids and accessibility
// props. Nothing is blurred — Jest renders no pixels anyway.

import type { BlurViewProps } from "expo-blur";
import * as React from "react";
import { View, type ViewInstance, type ViewProps } from "react-native";

/** The blur props (`intensity`, `tint`, …) are passed through: a test view ignores what it does not know. */
export const BlurView = React.forwardRef<ViewInstance, BlurViewProps>(function BlurView(props, ref): React.JSX.Element {
	return <View ref={ref} {...props} />;
});

export const BlurTargetView = React.forwardRef<ViewInstance, ViewProps>(function BlurTargetView(props, ref): React.JSX.Element {
	return <View ref={ref} {...props} />;
});
