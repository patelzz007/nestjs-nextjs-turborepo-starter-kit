// The device's network under Jest (jest.setup.ts mocks "expo-network" with
// this module): expo-network reads the OS, which has no JavaScript
// implementation here. Tests switch the connection with `setState`, which
// notifies listeners as the OS would; every test starts online.

import type { NetworkState } from "expo-network";

type NetworkListener = (state: NetworkState) => void;

const ONLINE: NetworkState = { isConnected: true, isInternetReachable: true };

let current: NetworkState = ONLINE;
const listeners = new Set<NetworkListener>();

export function getNetworkStateAsync(): Promise<NetworkState> {
	return Promise.resolve(current);
}

export function addNetworkStateListener(listener: NetworkListener): { readonly remove: () => void } {
	listeners.add(listener);
	return {
		remove: (): void => {
			listeners.delete(listener);
		},
	};
}

/** The OS reports a new network state. */
export function setState(state: NetworkState): void {
	current = state;
	listeners.forEach((listener: NetworkListener): void => {
		listener(state);
	});
}

export const OFFLINE_STATE: NetworkState = { isConnected: false, isInternetReachable: false };
export const ONLINE_STATE: NetworkState = ONLINE;

/** How many components follow the network now (zero after every unmount). */
export function listenerCount(): number {
	return listeners.size;
}

export function reset(): void {
	current = ONLINE;
	listeners.clear();
}
