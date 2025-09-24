# OptionQaaf Mobile App

A custom-built, design-forward React Native application for **OptionQaaf**, seamlessly integrated with Shopify. Built with performance, customization, and user experience in mind.

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

4. **Environment Setup:**
   Create a `.env` file with the following:
   ```env
   SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
   SHOPIFY_STOREFRONT_TOKEN=your_token
   EXPO_PUBLIC_SHOPIFY_CUSTOMER_CLIENT_ID=your_customer_app_client_id
   EXPO_PUBLIC_SHOPIFY_CUSTOMER_SCOPES="openid email profile customer.read customer.write"
   EXPO_PUBLIC_SHOPIFY_CUSTOMER_REDIRECT_PATH=auth/shopify
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
