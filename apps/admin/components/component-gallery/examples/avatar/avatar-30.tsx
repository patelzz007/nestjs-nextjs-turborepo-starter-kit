"use client";

import * as React from "react";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Spinner } from "@workspace/ui/components/spinner";

/** How often the demo flips between loading and loaded. */
const LOADING_TOGGLE_MS = 2000;

export function Avatar30Example(): React.JSX.Element {
	const [loading, setLoading] = useState(true);

	useEffect((): (() => void) => {
		const interval = setInterval((): void => {
			setLoading((prev: boolean): boolean => !prev);
		}, LOADING_TOGGLE_MS);
		return (): void => {
			clearInterval(interval);
		};
	}, []);

	return (
		<div className="relative">
			<Avatar>
				<AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
				<AvatarFallback>CN</AvatarFallback>
			</Avatar>
			{loading ? (
				<div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
					<Spinner className="text-primary" />
				</div>
			) : null}
		</div>
	);
}
