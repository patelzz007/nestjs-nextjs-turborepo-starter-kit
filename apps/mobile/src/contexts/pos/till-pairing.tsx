// TillPairing — the unpaired till (till-pairing-body.tsx), loaded lazily: the
// body and the camera scanner it opens are evaluated the first time the till
// shows it, never at the app's start (docs/architecture/ddd-cqrs-migration-plan.md
// §19.5). Until then a skeleton holds its place.

import * as React from "react";

import { lazyView } from "../../lib/lazy-view";
import type { TillPairingProps } from "./till-pairing-body";
import { TillViewSkeleton } from "./till-view-skeleton";

export type { TillPairingProps } from "./till-pairing-body";

export const TillPairing = lazyView<TillPairingProps>(
	async (): Promise<React.ComponentType<TillPairingProps>> => (await import("./till-pairing-body")).TillPairingBody,
	TillViewSkeleton,
);
