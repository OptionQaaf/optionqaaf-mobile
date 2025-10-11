export const CUSTOMER_BASICS_QUERY = `#graphql
  query CustomerBasics @inContext {
    customer {
      id
      displayName
      emailAddress {
        emailAddress
      }
      phone {
        phoneNumber
      }
      tags
      defaultAddress {
        id
        formatted
        firstName
        lastName
        address1
        address2
        city
        province
        zip
        country
      }
    }
  }
`

export const CUSTOMER_ADDRESSES_QUERY = `#graphql
  query CustomerAddresses @inContext {
    customer {
      addresses(first: 20) {
        nodes {
          id
          firstName
          lastName
          address1
          address2
          city
          province
          zip
          country
          formatted
        }
      }
    }
  }
`

export const CUSTOMER_ORDERS_QUERY = `#graphql
  query CustomerOrders($first: Int = 10) @inContext {
    customer {
      orders(first: $first, sortKey: CREATED_AT, reverse: true) {
        nodes {
          id
          name
          orderNumber
          processedAt
          financialStatus
          fulfillmentStatus
          totalPriceSet {
            presentmentMoney {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`
