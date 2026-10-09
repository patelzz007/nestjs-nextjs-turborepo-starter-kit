// The app's entry point (package.json → main). The WHATWG URL polyfill loads
// FIRST: React Native's built-in `URL` / `URLSearchParams` are partial (a base
// URL with a path is concatenated, not resolved), and @workspace/api-client and
// zod's URL checks rely on the standard behaviour. Then Expo Router takes over.
// The stylesheet is imported by the root layout (src/app/_layout.tsx), not here.

import "react-native-url-polyfill/auto";
import "expo-router/entry";
