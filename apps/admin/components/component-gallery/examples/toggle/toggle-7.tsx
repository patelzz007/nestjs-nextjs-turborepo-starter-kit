"use client";

import * as React from "react";
import { BellIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@workspace/ui/components/badge";

import { Toggle } from "@workspace/ui/components/toggle";

export function Toggle7Example(): React.JSX.Element {
	const [pressed, setPressed] = useState(false);

	return (
		<div className="flex items-center justify-center">
			<Toggle aria-label="Toggle notifications" pressed={pressed} onPressedChange={setPressed}>
				<div className="relative">
					<BellIcon />
					{!pressed ? (
						<Badge variant="destructive" size="xs" className="absolute -top-2 -right-2 rounded-full!">
							3
						</Badge>
					) : null}
				</div>
			</Toggle>
		</div>
	);
}
