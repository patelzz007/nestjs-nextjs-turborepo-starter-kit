import { Attachment } from "@workspace/ui-native/components/attachment";
import * as React from "react";

import RotateCwIcon from "lucide-react-native/icons/rotate-cw";

import { ignorePress } from "../example-support";

export function AttachmentDo2Example(): React.JSX.Element {
	return (
		<Attachment
			name="ledger-2024.xlsx"
			description="Failed · connection dropped"
			state="error"
			actions={[{ key: "retry", label: "Retry ledger-2024.xlsx", icon: RotateCwIcon, onPress: ignorePress }]}
		/>
	);
}
