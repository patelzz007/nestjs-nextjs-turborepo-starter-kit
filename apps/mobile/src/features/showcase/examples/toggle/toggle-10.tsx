import BookmarkIcon from "lucide-react-native/icons/bookmark";
import BookmarkCheckIcon from "lucide-react-native/icons/bookmark-check";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";

export function Toggle10Example(): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(false);
	return (
		<Toggle
			label="Bookmark"
			pressedLabel="Bookmarked"
			icon={BookmarkIcon}
			pressedIcon={BookmarkCheckIcon}
			variant="outline"
			pressed={pressed}
			onChange={setPressed}
			className="self-start"
		/>
	);
}
