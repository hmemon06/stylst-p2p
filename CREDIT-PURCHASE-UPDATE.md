# Credit Purchase UI Update

## What Changed

Updated the **redesign credits button** on the rate tab to allow users to proactively buy more credits anytime, not just when they run out.

---

## Before ❌

**Premium users with credits:**
- Tapped redesign counter → Went to `/paywall` (generic page)
- Could NOT easily buy more credits
- Had to wait until credits = 0 to see credit purchase options

**Premium users without credits:**
- Tapped redesign counter → Showed `on_pro_out_of_redesigns` paywall ✅

---

## After ✅

**All premium users (with OR without credits):**
- Tap redesign counter → Shows `on_pro_out_of_redesigns` paywall
- Can see and buy credit packs anytime (3pack, 10pack, 25pack)
- Encourages topping up before running out

**Non-premium users:**
- Tap redesign counter → Shows `trial_ended` paywall (unchanged)

---

## Code Changes

### File: `app/(tabs)/rate.tsx`

**Lines 201-221** - Updated `handleCreditTrackerPress()`:

```typescript
// Handle credit tracker press - show appropriate paywall
const handleCreditTrackerPress = async () => {
  if (isPremium) {
    // Premium user - always show credit purchase paywall so they can buy more anytime
    try {
      await registerPlacement({ placement: 'on_pro_out_of_redesigns' });
    } catch (error) {
      console.error('[Superwall] Error showing paywall:', error);
      // Fallback to regular paywall if Superwall fails
      router.push('/paywall');
    }
  } else {
    // Non-premium user - show trial ended paywall
    try {
      await registerPlacement({ placement: 'trial_ended' });
    } catch (error) {
      console.error('[Superwall] Error showing paywall:', error);
      router.push('/paywall');
    }
  }
};
```

**Key Change:**
- Removed the `if (userStats.redesign_credits <= 0)` check
- Premium users **always** see the credit purchase paywall when tapping the counter

---

## User Experience Flow

### Premium User with 15 Credits

1. **Rate tab** - Top right shows: `15 Redesigns` (gold text)
2. **User taps** the redesign counter
3. **Superwall shows** `on_pro_out_of_redesigns` paywall
4. **Paywall displays:**
   - 3 Redesign Pack - $1.99
   - 10 Redesign Pack - $4.99
   - 25 Redesign Pack - $9.99
5. **User buys** 25 pack
6. **RevenueCat webhook** grants +25 credits
7. **User now has** 15 + 25 = **40 credits**
8. **Credits display updates** to `40 Redesigns`

---

## Where Credit Purchase Paywall Shows

Now the `on_pro_out_of_redesigns` placement appears in **3 places**:

### 1. Rate Tab - Credit Counter (NEW ⭐)
**File:** `app/(tabs)/rate.tsx:206`
```typescript
await registerPlacement({ placement: 'on_pro_out_of_redesigns' });
```
**When:** Premium user taps redesign counter (anytime, even with credits)

### 2. Score Screen - Try to Redesign
**File:** `app/score.tsx:287`
```typescript
await registerPlacement({ placement: 'on_pro_out_of_redesigns' });
```
**When:** Premium user tries to redesign but has 0 credits

### 3. Rate Tab - Try to Scan
**File:** `app/(tabs)/rate.tsx:206`
```typescript
await registerPlacement({ placement: 'on_pro_out_of_redesigns' });
```
**When:** Premium user tries to scan but has 0 credits

---

## Benefits

1. ✅ **Better UX**: Users can top up credits before running out
2. ✅ **Increased Revenue**: Makes it easy to impulse-buy more credits
3. ✅ **Reduced Friction**: No need to wait until they're blocked
4. ✅ **Gamification**: Users can "stock up" on redesigns

---

## Superwall Configuration Needed

Make sure your `on_pro_out_of_redesigns` placement in Superwall:

1. **Shows credit packs prominently**:
   - 3 Redesigns - $1.99
   - 10 Redesigns - $4.99 (POPULAR)
   - 25 Redesigns - $9.99 (BEST VALUE)

2. **Has clear messaging**:
   - Title: "Get More Redesigns"
   - Subtitle: "Stock up and keep refining your style"
   - CTA: "Buy Now" or "Add Credits"

3. **References RevenueCat offering**: `stylst_redesigns`

---

## Testing

### Test as Premium User with Credits

1. Be logged in as premium user with 10+ credits
2. Go to Rate tab
3. Tap the redesign counter (top right)
4. ✅ Should see `on_pro_out_of_redesigns` paywall with 3 purchase options
5. Buy a pack (or close)
6. Verify you can tap again to see it anytime

### Test as Non-Premium User

1. Be logged in as free user (not subscribed)
2. Go to Rate tab
3. Tap the redesign counter
4. ✅ Should see `trial_ended` paywall (subscription options)

---

## Summary

Premium users can now **tap the redesign counter anytime** to buy more credits, making it a self-service credit shop. This increases engagement and revenue while improving the user experience.

🎉 Users no longer have to wait until they're out of credits to restock!
