import { NETWORK_TEST_IDLE_TIMEOUT_MS, whenJsThreadIdle } from "../facade";

describe("whenJsThreadIdle", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("runs a connection test only once the JS thread is idle, not synchronously", () => {
		const run = jest.fn<undefined, []>();
		whenJsThreadIdle(run);
		expect(run).not.toHaveBeenCalled();

		jest.runOnlyPendingTimers();
		expect(run).toHaveBeenCalledTimes(1);
	});

	it("does not run a test that was cancelled while it waited", () => {
		const run = jest.fn<undefined, []>();
		const cancel = whenJsThreadIdle(run);
		cancel();

		jest.runOnlyPendingTimers();
		expect(run).not.toHaveBeenCalled();
	});

	it("asks the runtime for a deadline, so a phone that never idles still gets a reading", () => {
		const spy = jest.spyOn(globalThis, "requestIdleCallback");
		whenJsThreadIdle(jest.fn<undefined, []>());

		expect(spy).toHaveBeenCalledWith(expect.any(Function), { timeout: NETWORK_TEST_IDLE_TIMEOUT_MS });
		spy.mockRestore();
	});
});
