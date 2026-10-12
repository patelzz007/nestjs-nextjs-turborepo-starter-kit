"use client";

import * as React from "react";

/**
 * Whether the page's layout is in motion — the panel springing as the sidebar
 * opens or collapses. Content whose rendering depends on its own size (a
 * chart) holds its size while it is, and fits once when it stops: a re-render
 * per frame would cost the animation its frames.
 *
 * It is a signal, not React state: a listener is called at the start and the
 * end of a motion and acts on the DOM itself, so a motion re-renders nothing.
 */
type LayoutTransitionListener = (isMoving: boolean) => void;

export interface LayoutTransitionSignal {
	/** Calls `listener` at every start (`true`) and end (`false`); returns the unsubscribe. */
	readonly subscribe: (listener: LayoutTransitionListener) => () => void;
	/** Reports the start (`true`) or end (`false`) of a motion; a repeat of the current state is ignored. */
	readonly report: LayoutTransitionListener;
}

/** A fresh signal: no listeners, at rest. */
export function createLayoutTransitionSignal(): LayoutTransitionSignal {
	const listeners = new Set<LayoutTransitionListener>();
	let isMoving = false;
	return {
		subscribe(listener: LayoutTransitionListener): () => void {
			listeners.add(listener);
			return (): void => {
				listeners.delete(listener);
			};
		},
		report(nextIsMoving: boolean): void {
			if (nextIsMoving === isMoving) {
				return;
			}
			isMoving = nextIsMoving;
			listeners.forEach((listener) => {
				listener(nextIsMoving);
			});
		},
	};
}

/** Outside a provider: nothing reports, nothing listens. */
const RESTING_SIGNAL = createLayoutTransitionSignal();

const LayoutTransitionContext = React.createContext<LayoutTransitionSignal>(RESTING_SIGNAL);

export interface LayoutTransitionProviderProps {
	readonly children: React.ReactNode;
}

/** Owns the layout-in-motion signal for everything under it (one per shell, for its lifetime). */
export function LayoutTransitionProvider({ children }: LayoutTransitionProviderProps): React.JSX.Element {
	const [signal] = React.useState(createLayoutTransitionSignal);
	return <LayoutTransitionContext.Provider value={signal}>{children}</LayoutTransitionContext.Provider>;
}

/** The reporter an animation calls at its start and end; does nothing outside a provider. */
export function useReportLayoutTransition(): LayoutTransitionListener {
	return React.useContext(LayoutTransitionContext).report;
}

/**
 * Calls `listener` whenever the layout starts or stops moving, without
 * re-rendering the caller. Keep `listener` stable (`useCallback`): a new one
 * re-subscribes.
 */
export function useLayoutTransitionListener(listener: LayoutTransitionListener): void {
	const signal = React.useContext(LayoutTransitionContext);
	React.useLayoutEffect((): (() => void) => signal.subscribe(listener), [listener, signal]);
}
