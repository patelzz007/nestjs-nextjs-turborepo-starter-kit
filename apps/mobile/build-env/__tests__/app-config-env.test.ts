import { APP_NAME_MAX_LENGTH, parseAppConfigEnv, passkeyAssociatedDomains } from "../app-config-env";

describe("the build's configuration", () => {
	it("names the starter's app when nothing is set, with every optional part off", () => {
		expect(parseAppConfigEnv({})).toStrictEqual({
			MOBILE_APP_NAME: "Starter",
			MOBILE_APP_SLUG: "starter",
			MOBILE_BUNDLE_ID: "com.example.starter",
			MOBILE_SCHEME: "starter",
			// An optional variable that is not set is absent from the result.
			EXPO_PUBLIC_ALLOW_LAN_HTTP_API: false,
		});
	});

	it("takes a product's own identity and build options", () => {
		const env = parseAppConfigEnv({
			MOBILE_APP_NAME: " Rewards ",
			MOBILE_APP_SLUG: "rewards-app",
			MOBILE_BUNDLE_ID: "com.acme.rewards",
			MOBILE_SCHEME: "rewards",
			MOBILE_PASSKEY_DOMAIN: "acme.com",
			EXPO_PUBLIC_ALLOW_LAN_HTTP_API: "true",
			GOOGLE_SERVICES_JSON: "./google-services.json",
			GOOGLE_SERVICES_PLIST: "./GoogleService-Info.plist",
			EAS_PROJECT_ID: "592c9738-0680-40f2-8f13-51db84601603",
		});

		expect(env).toMatchObject({
			MOBILE_APP_NAME: "Rewards",
			MOBILE_PASSKEY_DOMAIN: "acme.com",
			EXPO_PUBLIC_ALLOW_LAN_HTTP_API: true,
			EAS_PROJECT_ID: "592c9738-0680-40f2-8f13-51db84601603",
		});
	});

	it("treats a variable left empty as not set", () => {
		expect(parseAppConfigEnv({ MOBILE_PASSKEY_DOMAIN: " ", GOOGLE_SERVICES_JSON: "", EAS_PROJECT_ID: "", EXPO_PUBLIC_ALLOW_LAN_HTTP_API: "" })).toMatchObject({
			MOBILE_PASSKEY_DOMAIN: undefined,
			GOOGLE_SERVICES_JSON: undefined,
			EAS_PROJECT_ID: undefined,
			EXPO_PUBLIC_ALLOW_LAN_HTTP_API: false,
		});
	});

	it("stops the build naming every wrong variable", () => {
		expect(() =>
			parseAppConfigEnv({
				MOBILE_APP_NAME: "x".repeat(APP_NAME_MAX_LENGTH + 1),
				MOBILE_BUNDLE_ID: "com.acme-rewards",
				MOBILE_PASSKEY_DOMAIN: "https://acme.com",
				EXPO_PUBLIC_ALLOW_LAN_HTTP_API: "yes",
				EAS_PROJECT_ID: "my-project",
			}),
		).toThrow(/MOBILE_APP_NAME.*MOBILE_BUNDLE_ID.*MOBILE_PASSKEY_DOMAIN.*EXPO_PUBLIC_ALLOW_LAN_HTTP_API.*EAS_PROJECT_ID/su);
	});

	it("gives the iOS build the passkey domain's webcredentials entitlement, or none", () => {
		expect(passkeyAssociatedDomains("acme.com")).toStrictEqual(["webcredentials:acme.com"]);
		expect(passkeyAssociatedDomains(undefined)).toStrictEqual([]);
	});
});
