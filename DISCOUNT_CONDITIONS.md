# Kiscience Discount Conditions Guide

## Overview
Discounts are applied based on **BOTH customer conditions AND product conditions**. Both must match for a discount to apply.

---

## CUSTOMER CONDITIONS

### 1. All Customers
**applyToCustomers: "all"**
- ✅ Shows discount to: Everyone (logged-in + guests)
- ✅ Shopify Discount: **CREATED** (visible in Shopify Admin)
- ✅ PDP Display: Discount shown to all
- ✅ Cart/Checkout: Discount applied

---

### 2. Logged-In Customers
**applyToCustomers: "logged_in"**
- ✅ Shows discount to: Only logged-in customers
- ✅ Shopify Discount: **CREATED** (but applies to all at checkout - Shopify limitation)
- ✅ PDP Display: Discount shown only to logged-in users (via theme app)
- ⚠️ Cart/Checkout: Discount applies to all users (Shopify can't filter by login status)
- **Note:** The theme app ensures only logged-in customers see the discounted price on PDP

---

### 3. Non-Logged-In Customers (Guests)
**applyToCustomers: "non_logged_in"**
- ✅ Shows discount to: Only guests/non-logged-in users
- ❌ Shopify Discount: **NOT CREATED** (Shopify can't filter guests)
- ✅ PDP Display: Discount shown only to guests (via theme app)
- ❌ Cart/Checkout: Discount will NOT appear (Shopify limitation)

---

### 4. Specific Customers
**applyToCustomers: "specific"**
- ✅ Shows discount to: Only customers with matching email addresses
- ❌ Shopify Discount: **NOT CREATED** (Shopify can't filter by specific emails)
- ✅ PDP Display: Discount shown only to matching customers (via theme app)
- ❌ Cart/Checkout: Discount will NOT appear

---

### 5. Customer Tags (e.g., "practitioner")
**applyToCustomers: "customer_tags"**
- ✅ Shows discount to: Only customers with specified tags
- ❌ Shopify Discount: **NOT CREATED** (Shopify can't filter by tags)
- ✅ PDP Display: Discount shown only to tagged customers (via theme app)
- ❌ Cart/Checkout: Discount will NOT appear
- **Example:** Tag = "practitioner" → Only practitioners see discount

---

## PRODUCT CONDITIONS

### 1. All Products
**applyToProducts: "all"**
- ✅ Applies to: All products in store
- ✅ Shopify Discount: Targets all products

---

### 2. Specific Products
**applyToProducts: "specific_products"**
- ✅ Applies to: Only selected products (by product ID)
- ✅ Shopify Discount: Targets only these products
- ✅ PDP Display: Only shows discount on matching product pages

---

### 3. Specific Variants
**applyToProducts: "specific_variants"**
- ✅ Applies to: Only selected variants
- ✅ Shopify Discount: Targets the entire product (all variants)
- ✅ PDP Display: Only shows discount for matching variants
- **Note:** Shopify applies to whole product; theme app filters to specific variants

---

### 4. Product Tags
**applyToProducts: "product_tags"**
- ✅ Applies to: Products with specified tags
- ✅ Shopify Discount: Targets products with these tags
- ✅ PDP Display: Only shows discount on tagged products

---

### 5. Collections
**applyToProducts: "collections"**
- ✅ Applies to: All products in specified collections
- ✅ Shopify Discount: Targets all products in these collections
- ✅ PDP Display: Only shows discount on products in matching collections

---

## DISCOUNT RENDERING LOGIC

### PDP (Product Page Display)
- Theme app extension checks **BOTH** customer AND product conditions
- If both match → Discount percentage shown next to price ✅
- If either doesn't match → Regular price shown, no discount ✅

### Cart/Checkout (Automatic Discount Application)
- Shopify automatic discount applies based on product conditions
- Customer filtering limitations:
  - ✅ **Applies to all:** Works perfectly
  - ✅ **Applies to logged_in:** Discount appears (Shopify can't distinguish login status)
  - ❌ **Applies to non_logged_in:** Won't apply (Shopify limitation)
  - ❌ **Applies to specific customers:** Won't apply (Shopify limitation)
  - ❌ **Applies to customer_tags:** Won't apply (Shopify limitation)

---

## EXAMPLE SCENARIOS

### Scenario 1: "20% off all products for practitioners"
```
applyToCustomers: "customer_tags" → ["practitioner"]
applyToProducts: "all"
priceType: "percent_off"
discountValue: 20
```
- ✅ PDP: Practitioners see 20% off all products
- ❌ Cart: No discount (Shopify limitation)
- Shopify Discount: Not created

---

### Scenario 2: "31% off for all customers on specific product"
```
applyToCustomers: "all"
applyToProducts: "specific_products" → [ProductID]
priceType: "percent_off"
discountValue: 31
```
- ✅ PDP: Everyone sees 31% off on this product
- ✅ Cart: Discount applies to all
- Shopify Discount: Created ✅

---

### Scenario 3: "50% off specific variants for logged-in users"
```
applyToCustomers: "logged_in"
applyToProducts: "specific_variants" → [VariantID1, VariantID2]
priceType: "percent_off"
discountValue: 50
```
- ✅ PDP: Logged-in users see 50% off (only for matching variants)
- ⚠️ Cart: Discount applies to all variants of product (Shopify limitation)
- Shopify Discount: Created

---

## SUMMARY TABLE

| Customer Condition | Shopify Discount | PDP Display | Cart/Checkout |
|---|---|---|---|
| All Customers | ✅ Created | ✅ Works | ✅ Works |
| Logged-In | ✅ Created | ✅ Works | ⚠️ Applies to all |
| Non-Logged-In | ❌ Not Created | ✅ Works | ❌ None |
| Specific Customers | ❌ Not Created | ✅ Works | ❌ None |
| Customer Tags | ❌ Not Created | ✅ Works | ❌ None |

---

## TECHNICAL NOTES

- **Theme App Extension:** Runs JavaScript on PDP, checks all conditions, calculates discount
- **Shopify Automatic Discount:** Created via GraphQL API, applies at checkout, limited filtering
- **Metafield Sync:** All rules synced to shop metafield for theme app to read
- **Product Conditions:** All supported by Shopify (all, products, variants, tags, collections)
- **Customer Filtering:** Only "all" can be accurately filtered by Shopify; others handled by theme app

---

## FUTURE IMPROVEMENTS

To enable customer filtering at checkout:
1. **Implement Shopify Functions:** Native Shopify solution for post-purchase discounts
2. **Use Checkout Scripts:** Legacy approach with limited support
3. **Discount Codes:** Create customer-specific discount codes programmatically

