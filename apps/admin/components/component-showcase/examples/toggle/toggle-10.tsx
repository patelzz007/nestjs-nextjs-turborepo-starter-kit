"use client";

import * as React from "react";
import { BookmarkCheckIcon, BookmarkIcon } from "lucide-react";
import { useState } from "react";

import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle10Example(): React.JSX.Element {
	const [pressed, setPressed] = useState(false);

	return (
		<div className="flex items-center justify-center">
			<Toggle variant="outline" aria-label="Toggle bookmark" pressed={pressed} onPressedChange={setPressed}>
				{pressed ? <BookmarkCheckIcon className="fill-current" /> : <BookmarkIcon />}
				{pressed ? "Bookmarked" : "Bookmark"}
			</Toggle>
		</div>
	);
}
