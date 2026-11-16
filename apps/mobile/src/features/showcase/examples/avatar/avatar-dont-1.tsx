import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";

export function AvatarDont1Example(): React.JSX.Element {
	return <Avatar name="Ada Lovelace" imageUrl={null} badges={[{ label: "", color: "success" }]} />;
}
