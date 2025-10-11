import "dotenv/config"

const SHOP_DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_DOMAIN
const SHOP_ID = process.env.EXPO_PUBLIC_SHOPIFY_SHOP_ID
const ENDPOINT_ENV = process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_GRAPHQL_ENDPOINT

if (!SHOP_DOMAIN) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_DOMAIN")
if (!SHOP_ID) throw new Error("Missing EXPO_PUBLIC_SHOPIFY_SHOP_ID")

const customerGraphqlEndpoint =
  ENDPOINT_ENV || `https://shopify.com/${SHOP_ID}/account/customer/api/graphql`

const schemaToken = process.env.CUSTOMER_SCHEMA_TOKEN
if (!schemaToken) {
  throw new Error("Missing CUSTOMER_SCHEMA_TOKEN (temporary dev-only token for schema introspection)")
}

export default {
  schema: {
    [customerGraphqlEndpoint]: {
      headers: {
        Authorization: schemaToken,
      },
    },
  },
  documents: "./lib/shopify/customer/queries/**/*.graphql",
  generates: {
    "./lib/shopify/customer/gql/graphql.ts": {
      plugins: ["typescript", "typescript-operations", "typed-document-node"],
      config: {
        enumsAsTypes: true,
        nonOptionalTypename: true,
        scalars: {
          DateTime: "string",
          URL: "string",
          UnsignedInt64: "number",
        },
      },
    },
  },
} satisfies import("@graphql-codegen/cli").CodegenConfig
