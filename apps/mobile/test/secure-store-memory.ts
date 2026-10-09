// expo-secure-store under Jest: an in-memory store with the module's API.
// Tests seed raw values (to prove corrupt data is handled) and read what the
// app wrote. Failures can be injected per call to cover "store unavailable".

const values = new Map<string, string>();

export const memorySecureStore = {
	getItemAsync: jest.fn((key: string): Promise<string | null> => Promise.resolve(values.get(key) ?? null)),
	setItemAsync: jest.fn((key: string, value: string): Promise<void> => {
		values.set(key, value);
		return Promise.resolve();
	}),
	deleteItemAsync: jest.fn((key: string): Promise<void> => {
		values.delete(key);
		return Promise.resolve();
	}),
	/** The raw stored string of `key`, or `null`. */
	peek: (key: string): string | null => values.get(key) ?? null,
	/** Stores a raw string, bypassing the app's validation (to seed corrupt data). */
	seed: (key: string, raw: string): void => {
		values.set(key, raw);
	},
	reset: (): void => {
		values.clear();
	},
};
