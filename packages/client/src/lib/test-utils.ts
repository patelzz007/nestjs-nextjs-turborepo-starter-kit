// Test-only fetch helpers shared by the auth/ and api/ suites — the same ones
// @workspace/api-client's suites use. NEVER import this in production code.
export { fetchCalls, firstFetchCall, headersOf, inputUrl, jsonResponse, type FetchCall, type FetchImpl } from "@workspace/api-client/testing";
