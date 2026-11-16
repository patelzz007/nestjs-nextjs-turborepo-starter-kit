import * as React from "react";

/** What an asynchronous load has given so far. */
export type LoadState<T> = { readonly status: "loading" } | { readonly status: "ready"; readonly value: T } | { readonly status: "failed" };

/** A load's state, and how to try it again after it failed. */
export interface Loaded<T> {
	readonly state: LoadState<T>;
	readonly retry: () => void;
}

const LOADING: { readonly status: "loading" } = { status: "loading" };

/** What one load (one `load` function, one attempt) settled on. */
interface Settled<T> {
	readonly load: () => Promise<T>;
	readonly attempt: number;
	readonly state: LoadState<T>;
}

/**
 * The value `load` resolves to, loaded again whenever `load` changes (pass a memoised one) or on `retry`; a
 * failure is reported, never thrown. Until the current load settles, the state is `loading`.
 */
export function useLoaded<T>(load: () => Promise<T>): Loaded<T> {
	const [attempt, setAttempt] = React.useState<number>(0);
	const [settled, setSettled] = React.useState<Settled<T> | null>(null);
	React.useEffect((): (() => void) => {
		let active = true;
		load()
			.then((value: T): void => {
				if (active) {
					setSettled({ load, attempt, state: { status: "ready", value } });
				}
			})
			.catch((): void => {
				if (active) {
					setSettled({ load, attempt, state: { status: "failed" } });
				}
			});
		return (): void => {
			active = false;
		};
	}, [attempt, load]);
	const retry = React.useCallback((): void => {
		setAttempt((count: number): number => count + 1);
	}, []);
	const state = settled?.load === load && settled.attempt === attempt ? settled.state : LOADING;
	return { state, retry };
}
