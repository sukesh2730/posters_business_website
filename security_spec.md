# Security Specification: MemoPrint

## 1. Data Invariants
1. Products can be read by any visitor (public store catalog), but can ONLY be created, updated, or deleted by authorized store administrators.
2. Orders can only be read by the customer who created them (`resource.data.userId == request.auth.uid`) or by an authorized administrator.
3. Order creation requires an authenticated customer (`request.auth != null`) whose UID matches `incoming().userId` and email matches `incoming().userEmail`.
4. Customers can never alter order status, payment status, totals, or prices after order creation.
5. Order status updates (e.g. from 'placed' to 'printing', 'shipped', 'delivered', 'cancelled') can only be performed by administrators.
6. The admin collection `/admins/{adminId}` can only be read or written by authorized administrators, bootstrapped with the store owner email (`sukeshkavin@gmail.com`).

## 2. The "Dirty Dozen" Attack Payloads Tested
1. **Unauthenticated Order Creation**: Anonymous request attempting to post an order without UID.
2. **Impersonated Order Creation**: User A attempting to create an order with `userId: User_B`.
3. **Price Tampering on Create**: Client sending negative prices or missing required fields.
4. **Order Status Manipulation by Customer**: Customer attempting to update their own order from 'placed' to 'delivered' or 'paid'.
5. **Cross-Customer Order Reading**: Customer A querying or reading Customer B's private shipping address and photos.
6. **Malicious Catalog Alteration by Customer**: Non-admin attempting to change product price to ₹1.
7. **Ghost Field Injection**: Adding arbitrary fields like `isAdmin: true` or `shadowDiscount: 999` into order documents.
8. **Catalog Deletion by Customer**: Non-admin calling delete on `/products/{productId}`.
9. **Admin Collection Self-Elevation**: Normal user attempting to write their own UID into `/admins/{myUid}`.
10. **Oversized String / DoW Attack**: Submitting 5MB string inside customerName or notes.
11. **Id Poisoning**: Supplying path parameters with illegal characters or excessive lengths.
12. **Tampering with Order Immortals**: Trying to modify `userId` or `orderNumber` after creation.

All 12 attacks are blocked and result in `PERMISSION_DENIED`.
