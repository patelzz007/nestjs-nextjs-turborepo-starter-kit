// What a profile edit does to the query cache: defined once in `@workspace/api-client/react`
// (shared with the web apps). Mobile adds only its own wording for a stale edit.

export { applyOwnProfileUpdated, applyOwnProfileUpdateFailed, isStaleProfileVersionError } from "@workspace/api-client/react";

export const STALE_PROFILE_MESSAGE = "Your profile changed on another device. We loaded the latest version — please make your change again.";
