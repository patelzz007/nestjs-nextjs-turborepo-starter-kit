import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";

const PORTRAIT = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80";

export function UserAvatarDo2Example(): React.JSX.Element {
	return (
		<Avatar
			name="Grace Hopper"
			imageUrl={`${PORTRAIT}&w=256`}
			sources={[
				{ width: 64, url: `${PORTRAIT}&w=64` },
				{ width: 256, url: `${PORTRAIT}&w=256` },
			]}
			size="md"
		/>
	);
}
