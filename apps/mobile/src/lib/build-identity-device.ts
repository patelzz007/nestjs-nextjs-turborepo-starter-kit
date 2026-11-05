// The build identity read from the device (build-identity.ts): the EAS Update channel and the running
// update from expo-updates, and the install time from expo-application. Inside Expo Go the install
// time is the host app's, so it is left out there (as app-version.ts leaves out its version).

import * as Application from "expo-application";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { resolveBuildKind, type BuildIdentity } from "./build-identity";

/** Android knows when the APK was last installed over; iOS only when the app was first installed. */
function readInstalledAt(): Promise<Date | null> {
	if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
		return Promise.resolve(null);
	}
	return Platform.OS === "android" ? Application.getLastUpdateTimeAsync() : Application.getInstallationTimeAsync();
}

export function readBuildIdentity(): BuildIdentity {
	return {
		kind: resolveBuildKind({ isDevelopment: __DEV__, channel: Updates.channel }),
		runningUpdateCreatedAt: Updates.createdAt,
		isEmbeddedLaunch: Updates.isEmbeddedLaunch,
		readInstalledAt,
	};
}
