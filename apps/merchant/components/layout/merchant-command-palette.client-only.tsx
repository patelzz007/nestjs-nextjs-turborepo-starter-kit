"use client";

import dynamic from "next/dynamic";
import type * as React from "react";

import type { MerchantCommandPaletteProps } from "@/components/layout/merchant-command-palette";

/** A closed palette has no box: nothing to reserve while its chunk loads, and nothing on the server. */
function renderNothing(): null {
	return null;
}

const LazyMerchantCommandPalette = dynamic(() => import("@/components/layout/merchant-command-palette").then((module) => module.MerchantCommandPalette), {
	ssr: false,
	loading: renderNothing,
});

/**
 * The ⌘K palette, loaded only when it is opened (decision #65): it listens for a keydown on `document`
 * and reads recent searches and pins from `localStorage`, so it cannot render on the server. The
 * layout mounts it only while open; the server output is the closed state (nothing).
 */
export default function MerchantCommandPaletteClientOnly(props: MerchantCommandPaletteProps): React.JSX.Element {
	return <LazyMerchantCommandPalette {...props} />;
}
