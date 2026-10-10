// The device's network state from expo-network: read once, then followed
// through the OS's change events. expo-network's own `useNetworkState` leaves
// a failed first read unhandled and can set state after unmount; this one does
// neither.

import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from "expo-network";
import * as React from "react";

/** Nothing known yet: every field absent. */
const UNKNOWN: NetworkState = {};

export function useNetworkReading(): NetworkState {
	const [reading, setReading] = React.useState<NetworkState>(UNKNOWN);

	React.useEffect((): (() => void) => {
		let mounted = true;
		getNetworkStateAsync()
			.then((state: NetworkState): void => {
				if (mounted) {
					setReading(state);
				}
			})
			.catch((): void => {
				// The OS could not say: stay unknown until its first change event.
			});
		const subscription = addNetworkStateListener((state: NetworkState): void => {
			setReading(state);
		});
		return (): void => {
			mounted = false;
			subscription.remove();
		};
	}, []);

	return reading;
}
