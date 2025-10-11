# OptionQaaf Mobile App

A custom-built, design-forward React Native application for **OptionQaaf**, seamlessly integrated with Shopify. Built
with performance, customization, and user experience in mind.

---

## 🛍️ Overview

This app provides OptionQaaf's customers with a modern and intuitive mobile shopping experience across iOS and Android.

### ✨ Features (MVP)

- Modular home landing page (blocks, banners, product highlights)
- Product listing & detail pages with variants, sizes, and galleries
- Smooth cart & checkout flow via Shopify’s Checkout API
- Fast performance with native gestures and transitions
- Clean and modern UI that matches OptionQaaf's brand

---

## 📱 Tech Stack

- **Framework:** React Native + Expo
- **Backend:** Shopify Storefront & Admin APIs
- **Navigation:** `expo-router`
- **State Management:** Zustand / Context API (TBD)
- **UI Styling:** Tailwind CSS (via NativeWind)
- **Deployment:** EAS Build, App Store & Play Store

---

## 🚀 Getting Started

1. **Clone the repo:**

   ```bash
   git clone https://github.com/optionqaaf/optionqaaf-mobile.git
   cd optionqaaf-mobile
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Start the app:**

   ```bash
   npx expo start
   ```

4. **Environment Setup:** Create a `.env` file with the following:
   ```env
   EXPO_PUBLIC_SHOPIFY_SHOP_DOMAIN=optionqaaf.myshopify.com
   EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=your_token
   EXPO_PUBLIC_SHOPIFY_API_VERSION=2025-07
   EXPO_PUBLIC_SHOPIFY_CLIENT_ID=55f5b958-3344-457c-8fc7-0d1cadee09da
   EXPO_PUBLIC_SHOPIFY_SCOPES="openid email customer-account-api:full"
   EXPO_PUBLIC_SHOPIFY_AUTH_SCHEME=shop.1234567890.app://callback
   ```

---

## 🧩 Folder Structure (WIP)

```
.
├── app/                # Expo Router pages
├── components/         # Reusable UI components
├── lib/                # API & utilities
├── assets/             # Images, fonts, etc.
├── constants/          # Theme, colors, etc.
├── env.ts              # Typed env config
└── ...
```

---

## 🛠️ Development Notes

- Follows a modular and scalable component-based architecture
- Shopify checkout is external via `checkoutUrl`
- Authentication and customer features are included (wishlist, orders, etc.)
- Designed mobile-first, with future support for web possible via Expo Web
- Generate Shopify Customer Account GraphQL types (requires a temporary `shcat_` token):

  ```bash
  export CUSTOMER_SCHEMA_TOKEN=shcat_XXXX
  npm run codegen:customer
  # or with pnpm
  CUSTOMER_SCHEMA_TOKEN=shcat_XXXX pnpm run codegen:customer
  ```

  If your shop sits behind Cloudflare (common on custom domains) you may need to point the schema introspection at the
  customer GraphQL endpoint discovered from `https://<shop-domain>/.well-known/customer-account-api`:

  ```bash
  export CUSTOMER_SCHEMA_ENDPOINT=https://optionqaaf.com/account/customer/api/graphql
  CUSTOMER_SCHEMA_TOKEN=shcat_XXXX pnpm run codegen:customer
  ```

---

## 📦 Deployment

We use [EAS Build](https://docs.expo.dev/eas/) to generate production builds for iOS and Android:

```bash
eas build -p ios
eas build -p android
```

---

## 🧠 Credits

Developed by [@yznki](https://github.com/yznki) for the OptionQaaf team.

---

## 📄 License

This project is licensed under the MIT License.
