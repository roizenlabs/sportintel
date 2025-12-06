# SportIntel Refactoring Plan

## Problem Analysis

### 1. Pricing Tier Inconsistencies (CRITICAL)

There are **4 different sources** defining subscription tiers with conflicting data:

| Source | Free | Pro | Enterprise/Premium |
|--------|------|-----|-------------------|
| `lib/stripe.ts` (Stripe) | $0 | $49 | $199 |
| `Pricing.tsx` (Frontend) | $0 | $49 | "Custom" |
| `server-realtime.ts` fallback | $0 | $29.99 | $79.99 (called "Premium") |
| `stripe-routes.ts /tiers` | $0 | $49 | $199 |

**Conflicts:**
- `server-realtime.ts` uses old pricing ($29.99/$79.99) and different tier name ("Premium" vs "Enterprise")
- Frontend says Enterprise is "Custom" but Stripe has it at $199

### 2. Broken Footer Links (10+ dead links)

**Non-existent pages:**
- `/docs/changelog`
- `/docs/api`
- `/about`
- `/blog`
- `/careers`
- `/privacy`
- `/terms`
- `/responsible-gaming`
- `#api` anchor (no API section on landing page)

**Current routes (router.tsx):**
- `/` - Landing page
- `/dashboard` - Dashboard
- `/docs` - Placeholder ("Coming soon...")

### 3. Duplicate Subscription Tables

Two different subscription tracking systems:
- `user_subscriptions` table (for Stripe integration)
- `subscriptions` table (legacy, referenced in `server-realtime.ts`)

---

## Refactoring Plan

### Phase 1: Unify Pricing (Single Source of Truth)

**Step 1.1:** Update `server-realtime.ts` fallback pricing to match `lib/stripe.ts`:
- Location: [server-realtime.ts:553-557](api/server-realtime.ts#L553-L557)
- Change:
  - Pro: $29.99 -> $49
  - Premium -> Enterprise: $79.99 -> $199

**Step 1.2:** Update `Pricing.tsx` Enterprise pricing:
- Location: [Pricing.tsx:40-56](dashboard/src/components/landing/Pricing.tsx#L40-L56)
- Change Enterprise from "Custom" to "$199/month"
- Or: Keep "Custom" and remove Enterprise from Stripe (user decision needed)

**Step 1.3:** Make frontend fetch pricing from API:
- Have `Pricing.tsx` call `/api/subscription/tiers` instead of hardcoding
- Single source of truth = `lib/stripe.ts`

### Phase 2: Fix Footer Links

**Step 2.1:** Remove or disable broken links in `Footer.tsx`:
- Location: [Footer.tsx:4-40](dashboard/src/components/landing/Footer.tsx#L4-L40)

**Option A (Minimal - Recommended):** Remove all non-functional links
```
Keep only:
- #features (works)
- #pricing (works)
- /docs (exists)
- mailto: links (work)
- External links (twitter, github)
```

**Option B (Add placeholder pages):** Create stub pages for legal requirements:
- `/privacy` - Privacy Policy
- `/terms` - Terms of Service
- `/responsible-gaming` - Responsible Gaming notice

### Phase 3: Clean Up Legacy Code

**Step 3.1:** Consolidate subscription queries:
- Use `user_subscriptions` table consistently (Stripe integration)
- Update queries in `server-realtime.ts` that reference old `subscriptions` table

**Step 3.2:** Remove `/api/subscription/plans` endpoint:
- It returns old pricing from `subscription_plans` table
- Use `/api/subscription/tiers` instead (from stripe-routes.ts)

### Phase 4: Legal Pages (Optional but Recommended for Stripe)

Stripe compliance typically requires:
- Terms of Service
- Privacy Policy
- Refund Policy

**Step 4.1:** Create minimal legal page component
**Step 4.2:** Add routes for `/privacy`, `/terms`
**Step 4.3:** Update footer to link to real pages

---

## Files to Modify

1. **api/server-realtime.ts** - Fix fallback pricing, consolidate subscription queries
2. **dashboard/src/components/landing/Pricing.tsx** - Fetch from API or fix Enterprise pricing
3. **dashboard/src/components/landing/Footer.tsx** - Remove broken links
4. **dashboard/src/router.tsx** - Add legal page routes (if creating them)

## Estimated Changes

- 4 files modified
- ~50-100 lines changed
- Optional: 2-3 new page components if adding legal pages

---

## Decision Needed

Before implementing, please confirm:

1. **Enterprise pricing:**
   - A) Show $199/month (match Stripe)
   - B) Keep "Custom" and remove Enterprise from Stripe checkout

2. **Footer approach:**
   - A) Remove all broken links (minimal)
   - B) Create placeholder legal pages (recommended for Stripe compliance)

3. **API docs:**
   - A) Remove /docs link for now
   - B) Keep placeholder
   - C) Actually build API documentation
