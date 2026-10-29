# Rewards

The consumer rewards vertical: a merchant publishes rewards, a customer claims and redeems them, and a user can refer other users.

## Language

**Referrer**:
A user who refers another user.
_Avoid_: Inviter, sponsor, ambassador

**Referee**:
A user who was referred by a referrer.
_Avoid_: Invitee, friend, lead

### Reward referral

The reward-scoped relationship already in the product. It is a different thing from a signup referral.

**Reward referral**:
A recorded relationship between one referrer, one reward, and one attribution token. It names at most one referee.
_Avoid_: Signup referral, referral code

**Attribution token**:
The unique identifier of one reward referral.
_Avoid_: Referral code, coupon

**Referrer reward**:
The reward paid to the referrer when a reward referral is credited.
_Avoid_: Bonus, kickback, commission

**Referral pool**:
The limited number of referrer rewards one reward can pay.
_Avoid_: Quota, budget, cap

**Pending**:
A reward referral that has been recorded and has not been credited.
_Avoid_: Open, sent, waiting

**Credited**:
A reward referral whose referrer has received the referrer reward.
_Avoid_: Paid, settled, successful

**Blocked**:
A reward referral that will not be credited.
_Avoid_: Rejected, invalid, fraud

### Signup referral

**Referral code**:
A code owned by one referrer. Other people may register with that same code while it is valid.
_Avoid_: Attribution token, invite link, coupon

**Signup referral**:
The record that one referee registered with one referrer's referral code.
_Avoid_: Reward referral, invite, affiliate

**Successful**:
A signup referral whose referee has redeemed at least one reward.
_Avoid_: Credited, paid, converted

**Not redeemed**:
A signup referral whose referee has not redeemed a reward yet.
_Avoid_: Pending, open, waiting

## Context-owned terms

**Tenant** (tenancy):
The customer company and the isolation boundary: every tenant-owned row carries its `tenantId`. Shown to users as "Store" or "Business".
_Avoid_: Organization, org, account

**Location** (tenancy):
A branch inside one tenant. Never a tenant itself.
_Avoid_: Shop, outlet, site

**Membership** (tenancy):
The link between a user and a tenant, with a role and location scopes.
_Avoid_: Employment, seat

**Customer** (claims):
A user with no membership. Their claims and wallet are user-owned, not tenant-owned.
_Avoid_: Consumer account, member

**Platform staff** (identity):
RewardHub's own superadmins and admins, working in the admin app. Not tenant admins; on tenant data they need a support access grant.
_Avoid_: Tenant admin, operator

**Support access grant** (authorization):
A tenant owner's time-boxed, audited approval for platform staff to work inside that tenant.
_Avoid_: Backdoor, override

**System operation** (platform):
A named, audited privileged database access with an explicit table list. The only way any code passes an RLS bypass.
_Avoid_: Bypass, superuser mode

**Claim** (claims):
A customer's request to redeem one reward. The claims context owns the claim row and its one-time code.
_Avoid_: Redemption, coupon use

**Sale** (pos):
One checkout at a terminal. The point-of-sale context owns the sale. A repeated checkout with the same idempotency key is the same sale.
_Avoid_: Order, transaction

**Referral credit** (referrals):
The credit a referrer receives when a signup referral becomes successful. The referrals context owns the credit. The reward itself stays with rewards.
_Avoid_: Commission, payout

**KYB decision** (rewards):
The know-your-business outcome for a merchant's evidence files. Rewards owns the decision. Files owns the stored object and the scan verdict.
_Avoid_: Verification, approval

**Terminal pairing** (pos):
The one-time step that binds a till to a tenant and returns that till's API key. Tenants record the terminal. Point of sale performs the pairing.
_Avoid_: Login, device registration

**Store closure** (tenants):
Closing a location so it can no longer sell. Tenants owns the location lifecycle.
_Avoid_: Delete store, deactivate

### Platform operations

What the platform's own operators see and do about the platform itself, as opposed to anything a merchant or customer does.

**Server** (operations):
One machine the platform runs on, such as a DigitalOcean droplet. Its health is the machine's own CPU, memory, disk and network.
_Avoid_: Host, box, node, VPS

**Server agent** (operations):
The small program installed on a server that reports that server's health to the platform. On a developer's laptop, the laptop is the server.
_Avoid_: Daemon, collector, exporter

**Instance** (operations):
One running copy of a platform process (the API, a worker, the analytics consumer) on a server. One server can run several instances.
_Avoid_: Server, container, pod, replica

**Dependency** (operations):
A service the instances need but do not run themselves: PostgreSQL, Redis, Kafka, RabbitMQ and the job queues.
_Avoid_: Service, integration, backend

**Alert** (operations):
One incident in which a server, instance, dependency, service or objective crossed a threshold or went silent. It is open until the condition clears, and it is resolved after that.
_Avoid_: Notification, alarm, warning

**Backup** (operations):
A complete, downloadable copy of the platform's database at one moment.
_Avoid_: Snapshot, dump, export

**Pinned backup** (operations):
A backup that the retention period never removes.
_Avoid_: Kept, locked, archived

**Load test** (operations):
One run of synthetic traffic against the platform, with a fixed rate, a fixed duration and recorded results.
_Avoid_: Stress test, benchmark, performance test

**Scenario** (operations):
A named user journey, such as claiming a reward, replayed as synthetic traffic in a load test.
_Avoid_: Script, test case, flow

**Traffic mix** (operations):
A load test of the whole platform: every scenario at once, each with a weight.
_Avoid_: Full test, platform test, blend

**Load Test tenant** (operations):
The dedicated tenant, with its own seeded users, that every load test acts inside, so that no real tenant's data is touched.
_Avoid_: Test tenant, sandbox

**Load-test user** (operations):
A user who exists only inside the Load Test tenant, so that scenarios can act as it. It can never hold a platform role or join another tenant.
_Avoid_: Bot, fake user, virtual user

**Load-test purge** (operations):
Permanently removing everything the Load Test tenant and its load-test users created. It is the one removal in the platform that is not a soft delete.
_Avoid_: Reset, cleanup, wipe

### Application observability

What the platform's own code does while it runs, request by request and job by job, as opposed to the health of the machines it runs on. Shown to platform staff as *Observe*.

**Service** (observability):
One application registered to report what its code does, such as the API or the worker. Its instances are the running copies of it.
_Avoid_: App, project, source, Dependency

**Operation** (observability):
One named kind of work a service does: a route, a job, a message handler or a scheduled task.
_Avoid_: Endpoint, transaction, route

**Trace** (observability):
One run of an operation, from the moment it started to the moment it answered, together with everything it called along the way.
_Avoid_: Request, execution, transaction

**Span** (observability):
One timed call inside a trace, such as a method, a database query or an outgoing request.
_Avoid_: Step, segment, call

**Issue** (observability):
All the errors that share one cause, counted together however often they happen.
_Avoid_: Error group, exception, bug, incident

**Objective** (observability):
A promise one operation makes about how often it succeeds or how fast it answers, judged over a rolling window.
_Avoid_: SLO, target, SLA

**Release** (observability):
The version of a service that its instances were running when they reported.
_Avoid_: Deploy, build, version

**Replay** (observability):
A recording of what one person saw and did in a web page or the mobile app during a session, played back for platform staff.
_Avoid_: Session recording, screen recording, video

**Client key** (observability):
The public key a web page or mobile app reports with. It can only send telemetry, never read it.
_Avoid_: DSN, public token, app key
