import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";

import { AvatarGroup } from "@workspace/ui-native/components/avatar-group";

export function AvatarDo2Example(): React.JSX.Element {
	return (
		<AvatarGroup label="Ada, Alan and 9 others" extra={9}>
			<Avatar name="Ada Lovelace" imageUrl={null} size="md" />
			<Avatar name="Alan Turing" imageUrl={null} size="md" />
		</AvatarGroup>
	);
}
