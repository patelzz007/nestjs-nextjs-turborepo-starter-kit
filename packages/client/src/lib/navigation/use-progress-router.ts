"use client";

import { useNavigationProgress } from "@workspace/ui/components/navigation-progress";
import { useRouter } from "next/navigation";
import * as React from "react";

/** The App Router's own router object, so every caller keeps Next's typed routes. */
export type ProgressRouter = ReturnType<typeof useRouter>;

/**
 * `useRouter` from `next/navigation`, with `push` and `replace` starting the top progress
 * bar first. A link click starts the bar by itself; navigation in code does not, so app
 * code uses this hook instead (lint forbids the bare `useRouter` import outside this file).
 * `back`, `forward` and `refresh` pass through: the bar picks up back/forward from the browser.
 */
export function useProgressRouter(): ProgressRouter {
	const router = useRouter();
	const { start } = useNavigationProgress();
	return React.useMemo(
		(): ProgressRouter => ({
			...router,
			// The caller's arguments pass on exactly as given (no added `undefined` options).
			push: (href, ...rest): void => {
				start(href);
				router.push(href, ...rest);
			},
			replace: (href, ...rest): void => {
				start(href);
				router.replace(href, ...rest);
			},
		}),
		[router, start],
	);
}
