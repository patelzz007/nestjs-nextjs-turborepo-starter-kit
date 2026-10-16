"use client";

import { hasGlobalValue } from "@workspace/shared";
import * as React from "react";

const FULLSCREEN_CHANGE_EVENT = "fullscreenchange";

export interface FullscreenControls {
	/** Whether the page may put an element in fullscreen (`document.fullscreenEnabled`; `false` on iPhone Safari and during SSR). */
	readonly supported: boolean;
	/** Whether the element the ref points at is the fullscreen element right now. */
	readonly active: boolean;
	/** Enters fullscreen with the element, or leaves it. */
	readonly toggle: () => void;
}

function subscribeToFullscreenChange(onChange: () => void): () => void {
	document.addEventListener(FULLSCREEN_CHANGE_EVENT, onChange);
	return (): void => {
		document.removeEventListener(FULLSCREEN_CHANGE_EVENT, onChange);
	};
}

function readFullscreenSupport(): boolean {
	return hasGlobalValue("document") && document.fullscreenEnabled;
}

function serverFullscreenSupport(): boolean {
	return false;
}

function serverFullscreenActive(): boolean {
	return false;
}

/**
 * Fullscreen for one element (the Fullscreen API): whether it is supported, whether the
 * element is fullscreen — kept in step when the person leaves with Esc — and a toggle.
 * A refused request (no user gesture, a permissions policy) leaves the page as it was.
 */
export function useFullscreen<TElement extends HTMLElement>(elementRef: React.RefObject<TElement | null>): FullscreenControls {
	const supported = React.useSyncExternalStore(subscribeToFullscreenChange, readFullscreenSupport, serverFullscreenSupport);
	const readActive = React.useCallback((): boolean => document.fullscreenElement !== null && document.fullscreenElement === elementRef.current, [elementRef]);
	const active = React.useSyncExternalStore(subscribeToFullscreenChange, readActive, serverFullscreenActive);

	const toggle = React.useCallback((): void => {
		const element = elementRef.current;
		if (element === null) {
			return;
		}
		const request = document.fullscreenElement === element ? document.exitFullscreen() : element.requestFullscreen();
		request.catch((): void => undefined);
	}, [elementRef]);

	return { supported, active, toggle };
}
