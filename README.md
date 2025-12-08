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

   # Google Maps SDK (native maps rendering)
   EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY=ios_native_maps_key
   EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY=android_native_maps_key

   # Google Places & Geocoding web service
   EXPO_PUBLIC_GOOGLE_PLACES_KEY=web_services_key

   # Optional: limit Places suggestions to a specific country (ISO-2, e.g. AT)
   EXPO_PUBLIC_PLACES_COUNTRY=AT

   # Push notifications
   EXPO_PUBLIC_PUSH_WORKER_URL=https://your-worker-url
   EXPO_PUBLIC_PUSH_ADMIN_SECRET=your_admin_secret
   EXPO_PUBLIC_PUSH_ADMIN_EMAILS=admin1@example.com,admin2@example.com
   ```

   - **Where to get the keys:** Create credentials in the [Google Cloud Console](https://console.cloud.google.com/)
     under **APIs & Services → Credentials**. Generate three API keys:
     - iOS key restricted to the bundle identifier (`com.optionqaaf.app`) with **Maps SDK for iOS** enabled.
     - Android key restricted to the package name + SHA-1 certificate with **Maps SDK for Android** enabled.
     - Web services key restricted to trusted IPs/HTTP referrers with **Places API** and **Geocoding API** enabled.
       Paste the respective keys into the environment variables above. Remember to add these values to your EAS secrets
       before building.

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
