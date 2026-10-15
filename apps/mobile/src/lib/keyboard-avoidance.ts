// How a screen keeps what is being typed above the keyboard. Both platforms
// pad: iOS never resizes the window, and Android no longer does either — the
// app draws edge to edge (Expo's default since SDK 54, and Android 15's), so
// the window keeps its full height behind the keyboard and only padding by
// the keyboard's height lets the content above it scroll into view. The view
// that pads is components/keyboard-avoiding-view.tsx.

/** `KeyboardAvoidingView`'s `behavior` for every screen and sheet. */
export const KEYBOARD_AVOIDING_BEHAVIOR = "padding";
