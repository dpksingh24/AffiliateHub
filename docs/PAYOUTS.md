# How Store Admins Pay Affiliates (Commission Payouts)

This doc explains how merchants using your app pay commission to affiliates. It’s written for a **public app** where each store runs its own affiliate program.

---

## Current Model: Manual Payment + Record in App

Today the app **does not send money**. The store admin pays affiliates **outside the app** (e.g. PayPal, bank transfer, check), then uses the app to **record** that payment and keep affiliate balances correct.

### 1. Affiliate provides payment details

- Affiliates set their **Payment email** (e.g. PayPal email) in **Affiliate Area → Settings**.
- That value is stored as `paymentEmail` on the affiliate profile.
- Admins can see it when viewing an affiliate (e.g. in Referrals by affiliate or when recording a payout).

### 2. Admin sends payment outside the app

- The merchant pays the affiliate using their preferred method, for example:
  - **PayPal** – Send to the affiliate’s PayPal email.
  - **Bank transfer** – If the affiliate shared bank details elsewhere.
  - **Check** or other method.
- The app does **not** hold or move money; it only tracks **who earned what** and **what has been paid**.

### 3. Admin records the payout in the app

After sending money, the admin should record it so that:

- The **Payouts** page shows a proper history.
- Affiliate **earnings** (pending vs paid) stay correct.
- Referral rows show as **Paid** where applicable.

**Ways to record:**

- **Record a payout**  
  Use **Payouts → Record payout** (or equivalent): choose affiliate, amount, currency, method (e.g. “PayPal”), and optionally which **referral IDs** this payout covers. The app creates a payout record and marks those referrals as **Paid** (and updates the affiliate’s `earnings.paid` / `earnings.pending`).

- **Mark referrals as paid manually**  
  In **Referrals**, select the rows that were paid and use **Mark as paid** (or bulk action). This updates each referral’s status to **Paid** and moves that commission from pending to paid on the affiliate.  
  Optionally, the admin can also **create a payout record** (same as above) so the Payouts list has an entry for that payment.

### 4. What the app stores

- **Referral conversions** – Each order from an affiliate link: `status` = `pending` | `paid` | `rejected`, plus `commissionAmount`, etc.
- **Affiliate earnings** – `earnings.pending` and `earnings.paid` (updated when referrals are marked paid or when a payout is recorded with referral IDs).
- **Payouts** – Each record = “we paid this affiliate this amount on this date via this method” (and optionally which referral IDs it covers).

---

## For a Public App: What to Tell Merchants

You can expose this in-app (e.g. Help or a “How to pay affiliates” section) or in your app listing:

1. **Affiliates** enter a **Payment email** (e.g. PayPal) in Affiliate Area → Settings.
2. **You** pay them with your own PayPal/bank/check to that payment email.
3. **After** paying, **record the payout** in the app (Payouts → Record payout) and/or **mark the relevant referrals as Paid** in Referrals so balances and history stay correct.

No money is held or sent by the app; it only tracks commissions and payouts.

---

## Optional: Automated Payouts (Future)

To support **one-click pay** from inside the app (e.g. “Pay via PayPal”):

- Integrate **PayPal Payouts API** (or similar): the merchant connects their PayPal Business account; when they click “Pay affiliate”, the app sends money to the affiliate’s **payment email** via PayPal and then creates the payout record and marks referrals as paid.
- Requirements: PayPal app approval, handling of fees/limits, and making it clear that the **merchant’s** PayPal account is debited.

Same idea can apply to **Stripe Connect** or other payout providers if you want to scale beyond manual payments.

---

## Summary

| Who            | Action |
|----------------|--------|
| **Affiliate**  | Sets Payment email (e.g. PayPal) in Affiliate Area → Settings. |
| **Admin**      | Pays affiliate **outside the app** (PayPal, bank, etc.) to that email. |
| **Admin**      | **Records** the payout in the app and/or **marks referrals as Paid** so the app’s balances and Payouts history are correct. |
| **App**        | Tracks commissions, referral status (pending/paid/rejected), and payout history; does **not** send money. |
