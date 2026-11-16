"use client";

import * as React from "react";
import { HeartIcon } from "lucide-react";
import { useState } from "react";

import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle9Example(): React.JSX.Element {
	const [pressed, setPressed] = useState(false);

	return (
		<div className="flex items-center justify-center">
			<Toggle aria-label="Toggle favorite" pressed={pressed} onPressedChange={setPressed}>
				{pressed ? <HeartIcon className="fill-current" /> : <HeartIcon />}
			</Toggle>
		</div>
	);
}
