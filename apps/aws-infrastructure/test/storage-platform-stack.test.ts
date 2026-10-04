import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { InvalidApiRoleTrustError } from "../lib/api-role-trust.js";
import { StoragePlatformStack } from "../lib/storage-platform-stack.js";

/**
 * CDK synthesis is the slow part (seconds per stack on a CI runner). Each
 * stack is synthesized ONCE, in `beforeAll`, under this explicit budget; the
 * tests below are pure assertions on the template and keep vitest's default timeout.
 */
const SYNTH_TIMEOUT_MS = 60_000;

const OIDC_PROVIDER_ARN = "arn:aws:iam::123456789012:oidc-provider/oidc.eks.ap-southeast-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE";
const OIDC_ISSUER = "oidc.eks.ap-southeast-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE";
const CALLER_ROLE_ARN = "arn:aws:iam::210987654321:role/platform/api-runtime";

function synth(context: Readonly<Record<string, string>> = {}): Template {
	return Template.fromStack(new StoragePlatformStack(new App({ context }), "TestStack", { environmentName: "development" }));
}

/** The parts of a synthesized IAM policy statement these tests inspect (CloudFormation JSON, validated). */
const PolicyStatementSchema = z.object({
	Sid: z.string(),
	Effect: z.string(),
	Action: z.union([z.string(), z.array(z.string())]),
	Resource: z.json(),
});
type PolicyStatement = z.output<typeof PolicyStatementSchema>;
const PolicyResourceSchema = z.object({ Properties: z.object({ PolicyDocument: z.object({ Statement: z.array(PolicyStatementSchema) }) }) });

function apiRoleStatements(template: Template): PolicyStatement[] {
	return Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
		(resource: Record<string, z.core.util.JSONType>): PolicyStatement[] => PolicyResourceSchema.parse(resource).Properties.PolicyDocument.Statement,
	);
}

function statementWithSid(statements: readonly PolicyStatement[], sid: string): PolicyStatement {
	const statement = statements.find((candidate: PolicyStatement): boolean => candidate.Sid === sid);
	if (statement === undefined) {
		throw new Error(`no policy statement ${sid}`);
	}
	return statement;
}

function actionsOf(statement: PolicyStatement): string[] {
	return typeof statement.Action === "string" ? [statement.Action] : statement.Action;
}

describe("StoragePlatformStack", () => {
	let template: Template;

	beforeAll((): void => {
		template = synth();
	}, SYNTH_TIMEOUT_MS);

	it("creates private and public buckets with versioning, blocked public access and TLS-only policies", (): void => {
		template.resourceCountIs("AWS::S3::Bucket", 2);
		template.allResourcesProperties("AWS::S3::Bucket", {
			VersioningConfiguration: { Status: "Enabled" },
			PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
		});
		template.hasResourceProperties("AWS::S3::BucketPolicy", {
			PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Effect: "Deny", Condition: { Bool: { "aws:SecureTransport": "false" } } })]) },
		});
	});

	it("serves the public bucket through CloudFront with origin access control", (): void => {
		template.resourceCountIs("AWS::CloudFront::Distribution", 1);
		template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
	});

	it("provisions no queues, functions, alarms or scanners (the API scans uploads itself)", (): void => {
		for (const resourceType of ["AWS::SQS::Queue", "AWS::Lambda::Function", "AWS::Lambda::EventSourceMapping", "AWS::CloudWatch::Alarm"]) {
			template.resourceCountIs(resourceType, 0);
		}
		// No S3 → SQS/Lambda event notifications (CDK emits a custom resource for them).
		template.resourceCountIs("Custom::S3BucketNotifications", 0);
	});

	describe("API identity", () => {
		it("creates no IAM user and no access key anywhere — the API uses an IAM role", (): void => {
			template.resourceCountIs("AWS::IAM::User", 0);
			template.resourceCountIs("AWS::IAM::AccessKey", 0);
			template.resourceCountIs("AWS::IAM::Role", 1);
		});

		it("lets ECS tasks of this account assume the role by default", (): void => {
			template.hasResourceProperties("AWS::IAM::Role", {
				RoleName: "app-development-api",
				MaxSessionDuration: 3600,
				AssumeRolePolicyDocument: {
					Statement: [
						{
							Action: "sts:AssumeRole",
							Effect: "Allow",
							Principal: { Service: "ecs-tasks.amazonaws.com" },
							Condition: { StringEquals: { "aws:SourceAccount": { Ref: "AWS::AccountId" } } },
						},
					],
				},
			});
		});

		it("grants exactly the actions the API uses (S3 objects on the category prefixes, one CDN invalidation)", (): void => {
			const statements = apiRoleStatements(template);

			expect(statements.map((statement: PolicyStatement): string => statement.Sid).sort()).toEqual([
				"PrivateBucketMissingKeyAs404",
				"PrivateBucketObjects",
				"PublicCdnInvalidation",
				"PublicOriginPublish",
			]);
			for (const statement of statements) {
				expect(statement.Effect).toBe("Allow");
				for (const action of actionsOf(statement)) {
					expect(action, "no wildcard actions").not.toContain("*");
				}
			}

			const privateObjects = statementWithSid(statements, "PrivateBucketObjects");
			const publicOrigin = statementWithSid(statements, "PublicOriginPublish");
			expect(actionsOf(privateObjects).sort()).toEqual(["s3:DeleteObject", "s3:GetObject", "s3:PutObject"]);
			expect(actionsOf(publicOrigin).sort()).toEqual(["s3:DeleteObject", "s3:PutObject"]);
			expect(actionsOf(statementWithSid(statements, "PrivateBucketMissingKeyAs404"))).toEqual(["s3:ListBucket"]);

			const privateResources = JSON.stringify(privateObjects.Resource);
			for (const prefix of ["/staging/*", "/kyb/*", "/products/*", "/stores/*", "/users/*"]) {
				expect(privateResources).toContain(prefix);
			}
			const publicResources = JSON.stringify(publicOrigin.Resource);
			expect(publicResources).not.toContain("/kyb/*");
			expect(publicResources).not.toContain("/staging/*");
		});

		it("may invalidate only this stack's CloudFront distribution", (): void => {
			const statement = statementWithSid(apiRoleStatements(template), "PublicCdnInvalidation");
			const distributionIds = Object.keys(template.findResources("AWS::CloudFront::Distribution"));

			expect(actionsOf(statement)).toEqual(["cloudfront:CreateInvalidation"]);
			expect(distributionIds).toHaveLength(1);
			const resource = JSON.stringify(statement.Resource);
			expect(resource).toContain(":cloudfront::");
			expect(resource).toContain(":distribution/");
			expect(resource).toContain(`{"Ref":"${distributionIds[0] ?? ""}"}`);
			expect(resource).not.toContain("*");
		});

		it("exports the role ARN and the distribution id (no user name, no keys)", (): void => {
			expect(Object.keys(template.findOutputs("*")).sort()).toEqual([
				"ApiRoleArn",
				"CloudFrontDistributionId",
				"CloudFrontDomain",
				"PrivateBucketName",
				"PublicOriginBucketName",
			]);
		});
	});
});

describe("StoragePlatformStack API role trust (CDK context)", () => {
	it(
		"trusts one EKS service account through the cluster OIDC provider (IRSA)",
		(): void => {
			const template = synth({ apiTrust: "eks-irsa", apiTrustOidcProviderArn: OIDC_PROVIDER_ARN, apiTrustServiceAccount: "platform:storage-api" });

			template.hasResourceProperties("AWS::IAM::Role", {
				AssumeRolePolicyDocument: {
					Statement: [
						{
							Action: "sts:AssumeRoleWithWebIdentity",
							Effect: "Allow",
							Principal: { Federated: OIDC_PROVIDER_ARN },
							Condition: { StringEquals: { [`${OIDC_ISSUER}:sub`]: "system:serviceaccount:platform:storage-api", [`${OIDC_ISSUER}:aud`]: "sts.amazonaws.com" } },
						},
					],
				},
			});
		},
		SYNTH_TIMEOUT_MS,
	);

	it(
		"trusts an existing IAM role ARN",
		(): void => {
			const template = synth({ apiTrust: "aws-role", apiTrustRoleArn: CALLER_ROLE_ARN });

			template.hasResourceProperties("AWS::IAM::Role", {
				AssumeRolePolicyDocument: { Statement: [Match.objectLike({ Action: "sts:AssumeRole", Principal: { AWS: CALLER_ROLE_ARN } })] },
			});
		},
		SYNTH_TIMEOUT_MS,
	);

	it(
		"creates an instance profile (and exports it) for EC2",
		(): void => {
			const template = synth({ apiTrust: "ec2-instance" });

			template.resourceCountIs("AWS::IAM::InstanceProfile", 1);
			template.hasResourceProperties("AWS::IAM::Role", {
				AssumeRolePolicyDocument: { Statement: [Match.objectLike({ Principal: { Service: "ec2.amazonaws.com" } })] },
			});
			expect(Object.keys(template.findOutputs("*"))).toContain("ApiInstanceProfileArn");
		},
		SYNTH_TIMEOUT_MS,
	);

	it.each<[string, Readonly<Record<string, string>>]>([
		["an unknown trust kind", { apiTrust: "iam-user" }],
		["IRSA without a provider", { apiTrust: "eks-irsa", apiTrustServiceAccount: "platform:storage-api" }],
		["IRSA with a malformed service account", { apiTrust: "eks-irsa", apiTrustOidcProviderArn: OIDC_PROVIDER_ARN, apiTrustServiceAccount: "storage-api" }],
		["a role trust without an ARN", { apiTrust: "aws-role" }],
		["a role trust with a user ARN", { apiTrust: "aws-role", apiTrustRoleArn: "arn:aws:iam::210987654321:user/deployer" }],
	])("refuses to synthesize with %s", (_label: string, context: Readonly<Record<string, string>>): void => {
		expect(() => synth(context)).toThrow(InvalidApiRoleTrustError);
	});
});
