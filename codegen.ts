import type { CodegenConfig } from "@graphql-codegen/cli"
import * as dotenv from "dotenv"
dotenv.config()

const SHOPIFY_DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN!
const SHOPIFY_STOREFRONT_TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_TOKEN!
const SHOPIFY_API_VERSION = process.env.EXPO_PUBLIC_SHOPIFY_API_VERSION || "2024-10"

const config: CodegenConfig = {
  schema: {
    [`https://${SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`]: {
      headers: { "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN },
    },
  },
  documents: ["./lib/shopify/fragments.graphql", "./lib/shopify/queries/**/*.graphql"],
  generates: {
    "./lib/shopify/gql/graphql.ts": {
      plugins: ["typescript", "typescript-operations", "typed-document-node"],
      config: {
        enumsAsTypes: true,
        nonOptionalTypename: true,
      },
    },
  },
}
export default config
