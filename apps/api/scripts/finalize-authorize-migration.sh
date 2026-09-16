#!/bin/bash

# Finalize @Authorize decorator migration for all remaining controllers
# This script removes KernelIntegrationHelper from files that don't use it

set -e

cd "$(dirname "$0")/../src/modules"

# Files with 0 usages - just remove helper injection and import
FILES_NO_USAGE=(
  "rewards/controllers/merchant-onboarding.controller.ts"
  "rewards/controllers/redemptions.controller.ts"
  "rewards/controllers/consumer-rewards.controller.ts"
  "authorization/controllers/capabilities-catalog.controller.ts"
  "authorization/admin/audit.controller.ts"
  "health/version.controller.ts"
  "health/health.controller.ts"
  "notifications/email/email-log.controller.ts"
  "notifications/email/email-webhook.controller.ts"
  "sessions/session-status.controller.ts"
  "sample-category/sample-category.controller.ts"
)

echo "🧹 Removing KernelIntegrationHelper from files with no usage..."

for file in "${FILES_NO_USAGE[@]}"; do
  if [ -f "$file" ]; then
    echo "  Processing: $file"
    
    # Remove KernelIntegrationHelper import
    sed -i '/import.*KernelIntegrationHelper.*from.*kernel-integration\.helper/d' "$file"
    
    # Remove from constructor
    sed -i '/private readonly kernelHelper: KernelIntegrationHelper,/d' "$file"
    sed -i '/private readonly helper: KernelIntegrationHelper,/d' "$file"
    
    # Clean up any double empty lines
    sed -i '/^$/N;/^\n$/d' "$file"
  else
    echo "  ⚠️  File not found: $file"
  fi
done

echo "✅ Migration complete for files with no usage!"
echo ""
echo "⚠️  Files with actual requireAction/requireResourceAccess usage still need manual migration:"
echo "   - rewards/controllers/rewards-admin.controller.ts"
echo "   - rewards/controllers/reward-notifications.controller.ts"
echo "   - rewards/controllers/reward-legal.controller.ts"
echo "   - rewards/controllers/consumer-claims.controller.ts"
echo "   - rewards/controllers/organization-rewards.controller.ts"
echo "   - organization/controllers/organization-team-invite.controller.ts"
echo "   - organization/controllers/organization-admin.controller.ts"
echo "   - organization/controllers/organization.controller.ts"
echo "   - authorization-cedar/controllers/policy-control-plane.controller.ts"
echo "   - notifications/email/email-preview.controller.ts"
echo ""
echo "These files are already using @RequirePermission decorators for their main authorization."
echo "The KernelIntegrationHelper calls are redundant and can be removed, but require careful review."
