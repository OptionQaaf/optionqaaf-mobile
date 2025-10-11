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

4. **Environment Setup:** Copy `.env.example` to `.env` and populate the values:
   ```env
   EXPO_PUBLIC_SHOP_DOMAIN=optionqaaf.com
   EXPO_PUBLIC_CUSTOMER_APP_CLIENT_ID=bae78312-4865-4881-af68-c1eba8c61451
   EXPO_PUBLIC_SHOP_ID=85072904499
   EXPO_PUBLIC_OAUTH_REDIRECT_SCHEME=shop.85072904499.app
   EXPO_PUBLIC_OAUTH_SCOPES="openid email customer-account-api:full"
   EXPO_PUBLIC_DEBUG_AUTH=0

   # Storefront API (existing checkout/catalog integrations)
   EXPO_PUBLIC_SHOPIFY_DOMAIN=optionqaaf.myshopify.com
   EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=your_storefront_token
   EXPO_PUBLIC_SHOPIFY_API_VERSION=2025-07
   ```

   Add the redirect scheme to `app.json` if it is not present yet:
   ```json
   {
     "expo": {
       "scheme": ["shop.85072904499.app"]
     }
   }
   ```

   > **Heads up:** We disable the Expo AuthSession proxy so Shopify always receives the custom
   > redirect (`shop.85072904499.app://callback`). Make sure that exact scheme is registered in both
   > `app.json` and the Shopify Admin callback URL list; otherwise the hosted auth page will report
   > an `Invalid redirect_uri scheme` error when developing locally.

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

### 🔐 Customer Accounts (OTP)

- Customer sign-in uses Shopify Customer Account API with hosted OAuth + PKCE. Discovery starts from the storefront domain
  (`EXPO_PUBLIC_SHOP_DOMAIN`) and falls back to the Admin-provided endpoints only if discovery fails.
- Tokens are stored in `expo-secure-store` and refreshed when Shopify issues refresh tokens. Public-client flows without
  refresh tokens trigger a re-authentication when the access token expires.
- All customer data (profile, addresses, orders) is fetched via the Customer Account GraphQL API—no Storefront customer
  mutations remain. Errors such as `THROTTLED`, permission failures, or token expiry are surfaced through the global auth
  context.
- Logout clears the local session and calls the discovered end-session endpoint; mobile clients do not expect a redirect.

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
