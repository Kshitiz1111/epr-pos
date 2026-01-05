# Firestore Security Rules Update

## Problem
The store is getting "Missing or insufficient permissions" errors because the current Firestore security rules require authentication for all reads, but the storefront needs to be publicly accessible.

## Solution
Update your Firestore security rules to allow public read access to products and settings (for loyalty rules), while keeping other collections protected.

## Steps to Update

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** → **Rules** tab
4. Replace your current rules with the rules from `firestore.rules` file in this project
5. Click **Publish**

## What the New Rules Allow

### Public Access (No Authentication Required):
- **Products**: Public read access (for store browsing)
- **Settings/Loyalty**: Public read access (for loyalty rules display)
- **Orders**: Public read and create (for guest checkout and tracking)

### Authenticated Access Only:
- **Customers**: Read own data, create on signup
- **Users** (admin/staff): Authenticated read, admin write
- **Sales, Credits, Vendors, Purchase Orders, Ledger, Employees, Attendance**: Authenticated users only

## Important Notes

- The rules allow public read access to orders, but the service layer validates phone/email for guest tracking
- Customer documents can only be read by the customer themselves or admins
- All write operations (except order creation and customer signup) require authentication

## Testing

After updating the rules:
1. Visit `/store` - should load products without login
2. Try guest checkout - should work
3. Try order tracking - should work with order number + phone/email
4. Admin/staff login should still work normally

