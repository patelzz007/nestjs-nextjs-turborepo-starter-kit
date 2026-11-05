// This install's Firebase Installation ID (enhancement 5.3): FCM sends to an Android install by it, as
// firebase-admin deprecates sending by token. The SDK loads only where its native module exists (a build
// made after @react-native-firebase/installations was added); elsewhere, or if Firebase can't answer, the
// ID is unknown and the API keeps sending by token.

import { FirebaseInstallationIdSchema } from "@workspace/shared";
import { TurboModuleRegistry, type TurboModule } from "react-native";

/** The installations SDK's native module, registered by a build that includes it. */
export const INSTALLATIONS_NATIVE_MODULE = "NativeRNFBTurboInstallations";

/** How the ID is found (the real device, or a test's stand-ins). */
export interface InstallationIdLoader {
	hasNativeModule(): boolean;
	readId(): Promise<string>;
}

async function readFirebaseInstallationId(): Promise<string> {
	const { getId, getInstallations } = await import("@react-native-firebase/installations");
	return getId(getInstallations());
}

export const DEVICE_INSTALLATION_ID_LOADER: InstallationIdLoader = {
	hasNativeModule: (): boolean => TurboModuleRegistry.get<TurboModule>(INSTALLATIONS_NATIVE_MODULE) !== null,
	readId: readFirebaseInstallationId,
};

/** The ID, or null where this build can't tell it (never throws: the token still works). */
export async function firebaseInstallationId(loader: InstallationIdLoader = DEVICE_INSTALLATION_ID_LOADER): Promise<string | null> {
	if (!loader.hasNativeModule()) {
		return null;
	}
	try {
		return FirebaseInstallationIdSchema.safeParse(await loader.readId()).data ?? null;
	} catch {
		return null;
	}
}
