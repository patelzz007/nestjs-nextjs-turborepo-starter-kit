# Phase 5: E2E Tests for Authorization System

## Overview
Comprehensive end-to-end tests to verify the kernel-first authorization system works correctly across all layers.

## Test Categories

### 1. Basic Authorization Flow
- ✅ Public routes (no authorization required)
- ✅ Authenticated routes (@RequirePermission)
- ✅ Super-admin bypass
- ✅ Token version validation
- ✅ Admin access computation

### 2. Authorization Scenarios
**ALLOW Scenarios:**
- User with correct permission can access resource
- User with role that grants permission can access
- Super-admin can access any resource
- Owner can access their own resource

**DENY Scenarios:**
- User without permission denied
- User with revoked permission denied
- Expired token rejected
- Missing token rejected
- ACL DENY overrides role ALLOW

### 3. Kernel Integration
- `can()` returns correct decisions
- `authorize()` throws on DENY
- `filter()` returns correct WHERE clause
- `explain()` provides detailed reasoning
- Audit logs authorization decisions

### 4. RLS Enforcement
- RLS policies applied at database level
- Fail-closed when context missing
- Transaction-local context set correctly
- Cannot bypass RLS through direct queries

### 5. Performance Tests
- Authorization checks complete < 50ms
- No N+1 queries in permission checks
- Caching works correctly
- Concurrent requests handle correctly

## Test Files

### Unit Tests (Already Created)
- ✅ `/apps/api/src/modules/authorization/guards/__tests__/authorization.guard.spec.ts`
- ✅ `/apps/api/src/modules/authorization/kernel/__tests__/authorization-kernel.service.spec.ts`
- ✅ `/apps/api/src/modules/authorization/kernel/__tests__/policy-engine.service.spec.ts`
- ✅ `/apps/api/src/modules/authorization/kernel/__tests__/acl.service.spec.ts`

### E2E Tests (To Create)
- `/apps/api/test/authorization-kernel.e2e-spec.ts` - Main E2E tests
- `/apps/api/test/authorization-rls.e2e-spec.ts` - RLS enforcement tests
- `/apps/api/test/authorization-performance.e2e-spec.ts` - Performance tests

## Success Criteria
- All tests pass
- Test coverage > 80% for kernel modules
- Authorization decisions logged correctly
- RLS fail-closed verified
- Performance benchmarks met
