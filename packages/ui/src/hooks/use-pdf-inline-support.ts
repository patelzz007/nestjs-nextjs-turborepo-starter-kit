"use client";

import { readPdfInlineSupport } from "@workspace/ui/lib/media/pdf-inline-support";
import * as React from "react";

/** Support never changes while the page is open, so there is nothing to subscribe to. */
function subscribeToNothing(): () => void {
	return (): void => undefined;
}

/** Assumed during server rendering and hydration, so both render the viewer; the client then reads the real answer. */
function serverPdfInlineSupport(): boolean {
	return true;
}

/** Whether the browser can show a PDF inline — see `readPdfInlineSupport`. */
export function usePdfInlineSupport(): boolean {
	return React.useSyncExternalStore(subscribeToNothing, readPdfInlineSupport, serverPdfInlineSupport);
}
