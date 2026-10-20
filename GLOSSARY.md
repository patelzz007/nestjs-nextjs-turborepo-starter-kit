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
