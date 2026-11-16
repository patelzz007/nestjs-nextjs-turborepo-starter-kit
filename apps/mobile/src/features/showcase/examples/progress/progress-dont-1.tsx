import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";

// Five photos, a known amount of work: a spinner says nothing of how far along it is.
export function ProgressDont1Example(): React.JSX.Element {
	return <Spinner accessibilityLabel="Uploading photos" />;
}
