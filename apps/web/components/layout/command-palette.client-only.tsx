"use client";

import dynamic from "next/dynamic";
import type * as React from "react";

import type { CommandPaletteProps } from "@/components/layout/command-palette";

/** A closed palette has no box: nothing to reserve while its chunk loads, and nothing on the server. */
function renderNothing(): null {
	return null;
}

const LazyCommandPalette = dynamic(() => import("@/components/layout/command-palette").then((module) => module.CommandPalette), {
	ssr: false,
	loading: renderNothing,
});

/**
 * The ⌘K palette, loaded only when it is opened (decision #65): it listens for a keydown on `document`
 * and reads recent searches and pins from `localStorage`, so it cannot render on the server. The
 * layout mounts it only while open; the server output is the closed state (nothing).
 */
export default function CommandPaletteClientOnly(props: CommandPaletteProps): React.JSX.Element {
	return <LazyCommandPalette {...props} />;
}
