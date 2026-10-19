// Swagger text shared by the pull-request controllers.

/** The failures every pull-request read can answer with, beyond the standard 401 / 403 / 429. */
export const PULL_REQUEST_READ_ERRORS =
	"409 GITHUB_ACCOUNT_NOT_LINKED before you link a token, 409 GITHUB_TOKEN_REJECTED once GitHub stops accepting it (link a new one). " +
	"404 NOT_FOUND when GitHub has no such pull request or your token cannot see it. " +
	"503 SERVICE_UNAVAILABLE when GitHub is slow, unreachable or rate-limiting your token, 502 EXTERNAL_SERVICE_ERROR when it answers with an error — " +
	"both only when no earlier answer can be served instead. 503 GITHUB_PULL_REQUESTS_OFF when the server is not set up for pull requests.";

/** The failures a comment or review can answer with, beyond the reads' own. */
export const PULL_REQUEST_WRITE_ERRORS =
	"Posted to GitHub as your linked account. Send an Idempotency-Key header: a retry with the same key answers the first result instead of posting twice " +
	"(400 IDEMPOTENCY_KEY_REQUIRED without one). 409 GITHUB_WRITE_REJECTED when GitHub refuses it — approving your own pull request, a locked " +
	'conversation, or a token without "Pull requests: Read and write" — with GitHub\'s reason as the message. ';
