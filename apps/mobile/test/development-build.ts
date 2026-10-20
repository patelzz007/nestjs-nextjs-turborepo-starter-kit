/**
 * Switches the `__DEV__` global for a test, to exercise what a store build (`false`) or a development build
 * (`true`) does. React Native declares `__DEV__` as a global `const`, so it is set through `Reflect`; restore
 * the previous value after the test.
 */
export function setDevelopmentBuild(isDevelopment: boolean): void {
	Reflect.set(globalThis, "__DEV__", isDevelopment);
}
