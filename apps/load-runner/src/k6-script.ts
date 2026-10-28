// ============================================
// k6-script.ts — the JavaScript k6 runs (it executes in k6's own engine, not in Node)
// ============================================
// Kept as a string so it ships inside the runner; the runner writes it next to the run's config.
// Every request is tagged with its scenario step (`step`), which is how the runner breaks the run's
// latency down step by step, and carries the run's traffic key (its own rate-limit bucket).

/** The k6 script. It reads the run from `__ENV.LOAD_TEST_CONFIG` (see `k6-config.ts`). */
export function k6Script(): string {
	return String.raw`
import http from "k6/http";
import exec from "k6/execution";

const config = JSON.parse(open(__ENV.LOAD_TEST_CONFIG));
const api = config.baseUrl + config.apiPrefix;

export const options = {
	discardResponseBodies: false,
	summaryTrendStats: ["p(50)"],
	scenarios: {
		load: {
			executor: "ramping-arrival-rate",
			startRate: 0,
			timeUnit: "1s",
			preAllocatedVUs: config.virtualUsers,
			maxVUs: config.virtualUsers,
			stages: config.stages.map((stage) => ({ duration: stage.durationSeconds + "s", target: stage.target })),
		},
	},
};

const ok = http.expectedStatuses({ min: 200, max: 399 });
// A claim the customer already holds answers 409: an expected outcome, not a failure.
const claimOk = http.expectedStatuses({ min: 200, max: 399 }, 409);
const signedIn = { customer: false, staff: false };
let rewardIds = [];
let tenantRewardIds = [];

function headers(client) {
	const isMerchant = client === "merchant";
	return {
		"Content-Type": "application/json",
		"X-Mutation-Intent": "same-origin",
		Origin: isMerchant ? config.origins.merchant : config.origins.web,
		"X-Load-Test-Key": config.trafficKey,
		...(isMerchant ? { "X-Client-Type": "merchant" } : {}),
	};
}

function call(step, method, path, body, client, expected) {
	return http.request(method, api + path, body === null ? null : JSON.stringify(body), {
		headers: headers(client),
		tags: { step },
		responseCallback: expected || ok,
	});
}

function pick(list) {
	return list.length === 0 ? null : list[Math.floor(Math.random() * list.length)];
}

function idsOf(response) {
	try {
		const body = response.json();
		const list = Array.isArray(body.data) ? body.data : body.data && Array.isArray(body.data.items) ? body.data.items : [];
		return list.map((item) => item.id).filter((id) => typeof id === "string");
	} catch (error) {
		return [];
	}
}

function customer() {
	return config.customers[(exec.vu.idInTest - 1) % config.customers.length];
}

function staffMember() {
	return config.staff[(exec.vu.idInTest - 1) % config.staff.length];
}

function signIn(kind, force) {
	if (signedIn[kind] && !force) {
		return;
	}
	const user = kind === "staff" ? staffMember() : customer();
	const response = call("login", "POST", "/auth/login", { email: user.email, password: user.password }, kind === "staff" ? "merchant" : "web");
	signedIn[kind] = response.status >= 200 && response.status < 300;
}

const tenant = "/tenants/" + config.tenantSlug;

const scenarios = {
	"sign-in": () => {
		signIn("customer", true);
		call("session", "GET", "/auth/me", null, "web");
	},
	"browse-marketplace": () => {
		signIn("customer", false);
		rewardIds = idsOf(call("marketplace", "GET", "/rewards", null, "web"));
		call("marketplace-page-2", "GET", "/rewards?page=2", null, "web");
		const id = pick(rewardIds);
		if (id !== null) {
			call("reward", "GET", "/rewards/" + id, null, "web");
		}
	},
	"claim-reward": () => {
		signIn("customer", false);
		if (rewardIds.length === 0) {
			rewardIds = idsOf(call("reward", "GET", "/rewards", null, "web"));
		}
		const id = pick(rewardIds);
		if (id !== null) {
			call("claim", "POST", "/claims", { rewardId: id, phone: customer().phone }, "web", claimOk);
		}
		call("my-claims", "GET", "/claims", null, "web");
	},
	"merchant-dashboard": () => {
		signIn("staff", false);
		call("tenant-context", "GET", tenant + "/context", null, "merchant");
		tenantRewardIds = idsOf(call("rewards", "GET", tenant + "/rewards", null, "merchant"));
		call("analytics", "GET", tenant + "/analytics", null, "merchant");
	},
	"merchant-rewards": () => {
		signIn("staff", false);
		tenantRewardIds = idsOf(call("tenant-rewards", "GET", tenant + "/rewards", null, "merchant"));
		const id = pick(tenantRewardIds);
		if (id !== null) {
			call("tenant-reward", "GET", tenant + "/rewards/" + id, null, "merchant");
		}
	},
};

const totalWeight = config.scenarios.reduce((sum, entry) => sum + entry.weight, 0);

function chooseScenario() {
	let roll = Math.random() * totalWeight;
	for (const entry of config.scenarios) {
		roll -= entry.weight;
		if (roll < 0) {
			return entry.scenario;
		}
	}
	return config.scenarios[config.scenarios.length - 1].scenario;
}

export default function () {
	if (config.endpoint !== null) {
		signIn("customer", false);
		call("GET " + config.endpoint, "GET", config.endpoint, null, "web");
		return;
	}
	scenarios[chooseScenario()]();
}
`;
}
