import * as React from "react";
import { BookmarkIcon } from "lucide-react";
import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle6Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Toggle variant="outline" aria-label="Toggle bookmark">
				<BookmarkIcon className="group-aria-pressed/toggle:fill-accent-foreground" />
				Bookmark
			</Toggle>
		</div>
	);
}
