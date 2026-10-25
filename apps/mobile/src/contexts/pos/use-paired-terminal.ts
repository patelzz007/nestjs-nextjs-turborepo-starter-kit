// The till this phone is paired as, read once from Secure Store, with the two
// ways it changes: pairing (the API's answer to a pairing code is kept) and
// unpairing (forgotten on the device; the merchant revokes the key in the
// console). Device state, not server state — so not TanStack Query.

import * as React from "react";

import { forgetPairedTerminal, readPairedTerminal, savePairedTerminal, type PairedTerminal } from "./paired-terminal";

export type PairedTerminalState =
	| { readonly status: "loading" }
	| { readonly status: "unreadable" }
	| { readonly status: "unpaired" }
	| { readonly status: "paired"; readonly terminal: PairedTerminal };

export interface PairedTerminalControls {
	readonly state: PairedTerminalState;
	/** Reads the store again (after it could not be read). */
	readonly reload: () => void;
	readonly pair: (terminal: PairedTerminal) => Promise<void>;
	readonly unpair: () => Promise<void>;
}

export function usePairedTerminal(): PairedTerminalControls {
	const [state, setState] = React.useState<PairedTerminalState>({ status: "loading" });
	const [readCount, setReadCount] = React.useState(0);

	React.useEffect((): (() => void) => {
		let isCurrent = true;
		readPairedTerminal()
			.then((terminal: PairedTerminal | null): void => {
				if (isCurrent) {
					setState(terminal === null ? { status: "unpaired" } : { status: "paired", terminal });
				}
			})
			.catch((): void => {
				if (isCurrent) {
					setState({ status: "unreadable" });
				}
			});
		return (): void => {
			isCurrent = false;
		};
	}, [readCount]);

	const reload = React.useCallback((): void => {
		setState({ status: "loading" });
		setReadCount((count: number): number => count + 1);
	}, []);
	const pair = React.useCallback(async (terminal: PairedTerminal): Promise<void> => {
		await savePairedTerminal(terminal);
		setState({ status: "paired", terminal });
	}, []);
	const unpair = React.useCallback(async (): Promise<void> => {
		await forgetPairedTerminal();
		setState({ status: "unpaired" });
	}, []);

	return { state, reload, pair, unpair };
}
