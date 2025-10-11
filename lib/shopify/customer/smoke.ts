import { customerQuery } from "./client"

export async function caapiSmokeTest() {
  const response = await customerQuery<{
    customer: {
      id: string
      firstName: string | null
      lastName: string | null
    } | null
  }>(
    `
      query getCustomer {
        customer {
          id
          firstName
          lastName
        }
      }
    `,
  )

  if (response.errors && response.errors.length > 0) {
    console.warn("[CAAPI] GraphQL errors:", response.errors)
    throw new Error(response.errors.map((error) => error?.message ?? "Unknown error").join("; "))
  }

  if (!response.data?.customer) {
    throw new Error("Customer not found (are you logged in?)")
  }

  return response.data.customer
}
