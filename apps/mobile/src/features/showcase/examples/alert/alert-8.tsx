import CircleXIcon from "lucide-react-native/icons/circle-x";
import { Alert } from "@workspace/ui-native/components/alert";
import * as React from "react";

export function Alert8Example(): React.JSX.Element {
	return <Alert tone="error" icon={CircleXIcon} title="Something went wrong" message="We could not save your changes. Try again or contact support." />;
}
