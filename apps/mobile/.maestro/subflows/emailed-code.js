// Reads the six-digit code of the newest sign-in verification email (Mailpit tag `login-verification`) that
// arrived at or after REQUESTED_AT (milliseconds), from the local Mailpit at MAILPIT_URL, into `output.code`.
// Leaves it unset while no such email has arrived yet: the calling flow retries. The same lookup as the web
// suites' packages/client/src/testing/browser-sign-in.ts. Runs on the machine that runs Maestro.
const SEARCH_PATH = "/api/v1/search?query=tag%3Alogin-verification&limit=1";
const CODE_PATTERN = /\b(\d{6})\b/;

output.code = undefined;
const search = json(http.get(MAILPIT_URL + SEARCH_PATH).body);
const [newest] = search.messages;
if (newest !== undefined && Date.parse(newest.Created) >= Number(REQUESTED_AT)) {
	const message = json(http.get(MAILPIT_URL + "/api/v1/message/" + encodeURIComponent(newest.ID)).body);
	const found = CODE_PATTERN.exec(message.Text);
	if (found !== null) {
		const [, code] = found;
		output.code = code;
	}
}
