import { act, renderHook } from "@testing-library/react-native";

import { listenerCount, OFFLINE_STATE, ONLINE_STATE, setState } from "../../test/network-fake";
import { useNetworkReading } from "./use-network-reading";

describe("useNetworkReading", () => {
	it("reads the network state, follows its changes, and stops listening on unmount", async () => {
		const { result, unmount } = await renderHook(() => useNetworkReading());
		expect(result.current).toEqual(ONLINE_STATE);

		await act((): void => {
			setState(OFFLINE_STATE);
		});
		expect(result.current).toEqual(OFFLINE_STATE);

		await unmount();
		expect(listenerCount()).toBe(0);
	});
});
