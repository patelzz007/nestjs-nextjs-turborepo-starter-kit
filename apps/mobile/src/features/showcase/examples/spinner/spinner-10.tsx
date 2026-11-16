import { LoadingDots } from "@workspace/ui-native/components/spinner";
import * as React from "react";

export function Spinner10Example(): React.JSX.Element {
	return <LoadingDots accessibilityLabel="Loading" className="self-center" />;
}
