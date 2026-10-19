// TillCounter — the paired till at the counter (till-counter-body.tsx), loaded
// lazily: the body and the camera scanner it opens are evaluated the first time
// the till shows it, never at the app's start
// (docs/architecture/ddd-cqrs-migration-plan.md §19.5). Until then a skeleton
// holds its place.

import * as React from "react";

import { lazyView } from "../../lib/lazy-view";
import type { TillCounterProps } from "./till-counter-body";
import { TillViewSkeleton } from "./till-view-skeleton";

export type { TillCounterProps } from "./till-counter-body";

export const TillCounter = lazyView<TillCounterProps>(
	async (): Promise<React.ComponentType<TillCounterProps>> => (await import("./till-counter-body")).TillCounterBody,
	TillViewSkeleton,
);
