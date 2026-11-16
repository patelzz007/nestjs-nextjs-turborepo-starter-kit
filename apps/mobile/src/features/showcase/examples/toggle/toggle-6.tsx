import BookmarkIcon from "lucide-react-native/icons/bookmark";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";

export function Toggle6Example(): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(false);
	return <Toggle label="Bookmark" icon={BookmarkIcon} variant="outline" pressed={pressed} onChange={setPressed} className="self-start" />;
}
