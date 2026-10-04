import * as iam from "aws-cdk-lib/aws-iam";
import type { Node } from "constructs";
import { z } from "zod";

import { readContextString } from "./cdk-context.util.js";

/**
 * Who may assume the API's IAM role. The API never holds long-lived access
 * keys: its runtime obtains temporary credentials for this role and the AWS
 * SDK default credential chain picks them up.
 *
 * - `ecs-task`     — ECS / Fargate task role (default).
 * - `ec2-instance` — EC2 instance profile (the stack also creates the profile).
 * - `eks-irsa`     — EKS IAM Roles for Service Accounts, through the cluster's
 *                    OIDC provider, for one `namespace:service-account`.
 * - `aws-role`     — an existing IAM role (another account's runtime role, a
 *                    CI role, …) that assumes this one with `sts:AssumeRole`.
 *
 * Adding a runtime is one more variant here plus one case in
 * {@link apiRoleTrustPrincipal}.
 */
export type ApiRoleTrust =
	| { readonly kind: "ecs-task" }
	| { readonly kind: "ec2-instance" }
	| { readonly kind: "eks-irsa"; readonly oidcProviderArn: string; readonly serviceAccount: string }
	| { readonly kind: "aws-role"; readonly roleArn: string };

/** `arn:aws:iam::<12-digit account>:role/<path/name>` (any AWS partition). */
const IAM_ROLE_ARN_PATTERN = /^arn:aws[a-z-]*:iam::\d{12}:role\/[\w+=,.@/-]{1,512}$/;
/** `arn:aws:iam::<account>:oidc-provider/<issuer host/path>`; the issuer is captured. */
const OIDC_PROVIDER_ARN_PATTERN = /^arn:aws[a-z-]*:iam::\d{12}:oidc-provider\/([a-z0-9.-]+(?:\/[\w.-]+)*)$/;
/** Kubernetes `namespace:service-account` (DNS-1123 labels / subdomains). */
const SERVICE_ACCOUNT_PATTERN = /^([a-z0-9](?:[-a-z0-9]{0,61}[a-z0-9])?):([a-z0-9](?:[-.a-z0-9]{0,251}[a-z0-9])?)$/;

/** Audience the AWS STS web-identity exchange requires in an IRSA token. */
const STS_AUDIENCE = "sts.amazonaws.com";

const ApiRoleTrustSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("ecs-task") }),
	z.object({ kind: z.literal("ec2-instance") }),
	z.object({
		kind: z.literal("eks-irsa"),
		oidcProviderArn: z.string().regex(OIDC_PROVIDER_ARN_PATTERN, "apiTrustOidcProviderArn must be arn:aws:iam::<account>:oidc-provider/<issuer>"),
		serviceAccount: z.string().regex(SERVICE_ACCOUNT_PATTERN, "apiTrustServiceAccount must be <namespace>:<service-account>"),
	}),
	z.object({
		kind: z.literal("aws-role"),
		roleArn: z.string().regex(IAM_ROLE_ARN_PATTERN, "apiTrustRoleArn must be arn:aws:iam::<account>:role/<name>"),
	}),
]);

const DEFAULT_TRUST_KIND = "ecs-task";

/** Thrown at synth time when the trust context is incomplete or malformed. */
export class InvalidApiRoleTrustError extends Error {
	public constructor(details: string) {
		super(`Invalid API role trust (-c apiTrust=ecs-task|ec2-instance|eks-irsa|aws-role): ${details}`);
		this.name = "InvalidApiRoleTrustError";
	}
}

/** Validates a trust description; every problem is reported at once. */
export function parseApiRoleTrust(input: Readonly<Record<string, string | undefined>>): ApiRoleTrust {
	const parsed = ApiRoleTrustSchema.safeParse(input);
	if (!parsed.success) {
		throw new InvalidApiRoleTrustError(parsed.error.issues.map((issue: z.core.$ZodIssue): string => issue.message).join("; "));
	}
	return parsed.data;
}

/**
 * Reads the trust from CDK context: `apiTrust` (default `ecs-task`) plus
 * `apiTrustOidcProviderArn` + `apiTrustServiceAccount` (eks-irsa) or
 * `apiTrustRoleArn` (aws-role).
 */
export function readApiRoleTrust(node: Node): ApiRoleTrust {
	return parseApiRoleTrust({
		kind: readContextString(node, "apiTrust") ?? DEFAULT_TRUST_KIND,
		oidcProviderArn: readContextString(node, "apiTrustOidcProviderArn"),
		serviceAccount: readContextString(node, "apiTrustServiceAccount"),
		roleArn: readContextString(node, "apiTrustRoleArn"),
	});
}

function oidcIssuerOf(oidcProviderArn: string): string {
	const issuer = OIDC_PROVIDER_ARN_PATTERN.exec(oidcProviderArn)?.[1];
	if (issuer === undefined) {
		throw new InvalidApiRoleTrustError("apiTrustOidcProviderArn has no issuer");
	}
	return issuer;
}

/** `namespace:name` → the `sub` claim EKS puts in the service account's token. */
function kubernetesServiceAccountSubject(serviceAccount: string): string {
	const match = SERVICE_ACCOUNT_PATTERN.exec(serviceAccount);
	const namespace = match?.[1];
	const name = match?.[2];
	if (namespace === undefined || name === undefined) {
		throw new InvalidApiRoleTrustError("apiTrustServiceAccount must be <namespace>:<service-account>");
	}
	return `system:serviceaccount:${namespace}:${name}`;
}

/**
 * The principal allowed to assume the API role. Service principals are
 * pinned to this account (`aws:SourceAccount`) against the confused-deputy
 * problem; IRSA is pinned to one service account and the STS audience.
 */
export function apiRoleTrustPrincipal(trust: ApiRoleTrust, account: string): iam.IPrincipal {
	switch (trust.kind) {
		case "ecs-task":
			return new iam.ServicePrincipal("ecs-tasks.amazonaws.com", { conditions: { StringEquals: { "aws:SourceAccount": account } } });
		case "ec2-instance":
			return new iam.ServicePrincipal("ec2.amazonaws.com", { conditions: { StringEquals: { "aws:SourceAccount": account } } });
		case "eks-irsa": {
			const issuer = oidcIssuerOf(trust.oidcProviderArn);
			return new iam.WebIdentityPrincipal(trust.oidcProviderArn, {
				StringEquals: {
					[`${issuer}:sub`]: kubernetesServiceAccountSubject(trust.serviceAccount),
					[`${issuer}:aud`]: STS_AUDIENCE,
				},
			});
		}
		case "aws-role":
			return new iam.ArnPrincipal(trust.roleArn);
		default:
			return assertNever(trust);
	}
}

function assertNever(value: never): never {
	throw new InvalidApiRoleTrustError(`unhandled trust ${JSON.stringify(value)}`);
}
