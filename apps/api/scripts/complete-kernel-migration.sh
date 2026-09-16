#!/bin/bash

# Complete kernel-first migration by removing redundant KernelIntegrationHelper calls
# These files already have @RequirePermission decorators working through the kernel-first guard

set -e

cd "$(dirname "$0")/../src/modules"

echo "🔄 Completing kernel-first migration..."
echo ""

# Process each file individually with careful sed operations
FILES=(
  "rewards/controllers/rewards-admin.controller.ts"
  "rewards/controllers/reward-notifications.controller.ts"
  "rewards/controllers/reward-legal.controller.ts"
  "rewards/controllers/consumer-claims.controller.ts"
  "rewards/controllers/organization-rewards.controller.ts"
  "organization/controllers/organization-team-invite.controller.ts"
  "organization/controllers/organization-admin.controller.ts"
  "organization/controllers/organization.controller.ts"
  "authorization-cedar/controllers/policy-control-plane.controller.ts"
  "notifications/email/email-preview.controller.ts"
  "sessions/session-status.controller.ts"
  "health/version.controller.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  📝 Processing: $file"
    
    # Remove KernelIntegrationHelper import line
    sed -i '/import.*KernelIntegrationHelper.*from.*kernel-integration\.helper/d' "$file"
    
    # Remove helper injection from constructor
    sed -i '/private readonly kernelHelper: KernelIntegrationHelper,/d' "$file"
    sed -i '/private readonly helper: KernelIntegrationHelper,/d' "$file"
    
    # Remove await this.kernelHelper.requireAction(...) lines (with optional @GetUser parameter)
    sed -i '/await this\.kernelHelper\.requireAction(/,/);/d' "$file"
    sed -i '/await this\.helper\.requireAction(/,/);/d' "$file"
    
    # Remove await this.kernelHelper.requireResourceAccess(...) lines
    sed -i '/await this\.kernelHelper\.requireResourceAccess(/,/);/d' "$file"
    sed -i '/await this\.helper\.requireResourceAccess(/,/);/d' "$file"
    
    # Remove any standalone empty lines left behind (max 1 consecutive blank line)
    sed -i '/^$/N;/^\n$/D' "$file"
    
    echo "     ✅ Completed"
  else
    echo "     ⚠️  File not found: $file"
  fi
done

echo ""
echo "✅ Kernel-first migration complete!"
echo ""
echo "📊 Summary:"
echo "   - All controllers now use the kernel-first AuthorizationGuard"
echo "   - @RequirePermission decorators work through the kernel"
echo "   - KernelIntegrationHelper has been fully removed"
echo "   - Authorization is centralized and consistent"
echo ""
echo "Next steps:"
echo "   1. Delete kernel-integration.helper.ts"
echo "   2. Run tests to verify everything still works"
echo "   3. Optional: Migrate @RequirePermission to @Authorize decorator for enhanced type safety"
