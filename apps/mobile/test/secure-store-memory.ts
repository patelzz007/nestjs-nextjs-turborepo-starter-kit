// expo-secure-store under Jest: an in-memory store with the module's API.
// Tests seed raw values (to prove corrupt data is handled) and read what the
// app wrote. Failures can be injected per call to cover "store unavailable";
// `reset()` (before every test, jest.setup.ts) restores the working store, so
// an injected failure never leaks into the next test.

const values = new Map<string, string>();

function read(key: string): Promise<string | null> {
	return Promise.resolve(values.get(key) ?? null);
}

function write(key: string, value: string): Promise<void> {
	values.set(key, value);
	return Promise.resolve();
}

function remove(key: string): Promise<void> {
	values.delete(key);
	return Promise.resolve();
}

export const memorySecureStore = {
	getItemAsync: jest.fn(read),
	setItemAsync: jest.fn(write),
	deleteItemAsync: jest.fn(remove),
	/** The raw stored string of `key`, or `null`. */
	peek: (key: string): string | null => values.get(key) ?? null,
	/** Stores a raw string, bypassing the app's validation (to seed corrupt data). */
	seed: (key: string, raw: string): void => {
		values.set(key, raw);
	},
	/** Empties the store and undoes any injected failure. */
	reset: (): void => {
		values.clear();
		memorySecureStore.getItemAsync.mockImplementation(read);
		memorySecureStore.setItemAsync.mockImplementation(write);
		memorySecureStore.deleteItemAsync.mockImplementation(remove);
	},
};
