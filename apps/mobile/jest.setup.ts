// Runs before every mobile test file (jest.config.js → setupFilesAfterEnv).
// Only BOUNDARIES are replaced here — native modules with no JavaScript
// implementation under Jest (ADR 031, rules/11): the OS secret store becomes an
// in-memory map each test can inspect and reset, the device's network is a fake
// each test can switch offline, Uniwind (compiled by Metro) renders unstyled,
// the native blur view is a plain view, random UUIDs come from Node, and Reanimated's native worklet runtime
// runs on the JS thread. Files and uploads (expo-file-system) and the photo
// library (expo-image-picker) are fakes each test can fill, and the camera
// (expo-camera) reads whatever QR code a test hands it. Every query client a test creates is disposed after
// the test, so no cache timer keeps the worker alive.

import "@testing-library/react-native/matchers";
import { cleanup } from "@testing-library/react-native";
import type * as KeyboardController from "react-native-keyboard-controller";
import type * as Worklets from "react-native-worklets";

// `mock…` names are the only outer variables a hoisted jest.mock factory may use.
import * as mockBlur from "./test/expo-blur-mock";
import * as mockCamera from "./test/expo-camera-fake";
import * as mockCrypto from "./test/expo-crypto-mock";
import * as mockFileSystem from "./test/expo-file-system-fake";
import * as mockImagePicker from "./test/expo-image-picker-fake";
import * as mockNetwork from "./test/network-fake";
import { disposeTrackedQueryClients } from "./test/query-clients";
import { memorySecureStore as mockSecureStore } from "./test/secure-store-memory";
import * as mockUniwind from "./test/uniwind-mock";

jest.mock("expo-secure-store", () => mockSecureStore);
// The OS network state (test/network-fake.ts): online unless a test switches it.
jest.mock("expo-network", () => mockNetwork);
// Uniwind compiles styles in Metro, not under Jest (test/uniwind-mock.tsx).
jest.mock("uniwind", () => mockUniwind);
// The blur is a native view (test/expo-blur-mock.tsx): a plain view that still takes refs and animated props.
jest.mock("expo-blur", () => mockBlur);
// Random UUIDs (idempotency keys) and digests (upload checksums) come from native code (test/expo-crypto-mock.ts).
jest.mock("expo-crypto", () => mockCrypto);
// Files on the phone and their uploads are native (test/expo-file-system-fake.ts).
jest.mock("expo-file-system", () => mockFileSystem);
// The photo library is the OS's (test/expo-image-picker-fake.ts).
jest.mock("expo-image-picker", () => mockImagePicker);
// The camera and its QR scanner are the OS's (test/expo-camera-fake.tsx).
jest.mock("expo-camera", () => mockCamera);
// The keyboard is the OS's: keyboard-controller's own Jest stand-in (its provider and views render plain).
jest.mock("react-native-keyboard-controller", () => jest.requireActual<typeof KeyboardController>("react-native-keyboard-controller/jest"));
// Reanimated's worklet runtime is native; its own Jest stand-in runs worklets on the JS thread,
// so the real Reanimated (springs, animated styles) runs under test (ADR 036).
jest.mock("react-native-worklets", () => jest.requireActual<typeof Worklets>("react-native-worklets/src/mock"));

beforeEach(() => {
	mockSecureStore.reset();
	mockNetwork.reset();
	mockFileSystem.reset();
	mockImagePicker.reset();
	mockCamera.reset();
});

// Query clients' garbage-collection timers must not outlive the test (test/query-clients.ts).
// Unmounting destroys query observers, which schedules those timers, so the
// rendered trees are unmounted FIRST (Testing Library's own cleanup is
// idempotent), then the clients are disposed.
afterEach(async () => {
	await cleanup();
	disposeTrackedQueryClients();
});
