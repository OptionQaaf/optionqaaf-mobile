export const ACCOUNT_ADDRESS_FRAGMENT = /* GraphQL */ `
  fragment AccountAddressFields on MailingAddress {
    id
    name
    firstName
    lastName
    address1
    address2
    city
    province
    zip
    country
    phone
  }
`

export const ACCOUNT_ORDER_FRAGMENT = /* GraphQL */ `
  fragment AccountOrderFields on Order {
    id
    number
    name
    processedAt
    financialStatus
    fulfillmentStatus
    totalPrice {
      amount
      currencyCode
    }
    lineItems(first: 50) {
      edges {
        node {
          id
          title
          quantity
          price {
            amount
            currencyCode
          }
        }
      }
    }
  }
`

export const ACCOUNT_CUSTOMER_FRAGMENT = /* GraphQL */ `
  ${ACCOUNT_ADDRESS_FRAGMENT}
  ${ACCOUNT_ORDER_FRAGMENT}
  fragment AccountCustomerFields on Customer {
    id
    firstName
    lastName
    email
    phone
    defaultAddress {
      ...AccountAddressFields
    }
    addresses(first: 20) {
      edges {
        node {
          ...AccountAddressFields
        }
      }
    }
    orders(first: 20, reverse: true) {
      edges {
        node {
          ...AccountOrderFields
        }
      }
    }
  }
`

export const CUSTOMER_ME_QUERY = /* GraphQL */ `
  ${ACCOUNT_CUSTOMER_FRAGMENT}
  query CustomerMe {
    customer @inContext(language: EN) {
      ...AccountCustomerFields
    }
  }
`

export const CUSTOMER_UPDATE_MUTATION = /* GraphQL */ `
  ${ACCOUNT_CUSTOMER_FRAGMENT}
  mutation CustomerUpdate($input: CustomerUpdateInput!) {
    customerUpdate(customer: $input) {
      customer {
        ...AccountCustomerFields
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const CUSTOMER_ADDRESS_CREATE_MUTATION = /* GraphQL */ `
  ${ACCOUNT_CUSTOMER_FRAGMENT}
  mutation CustomerAddressCreate($input: MailingAddressInput!) {
    customerAddressCreate(address: $input) {
      customerAddress {
        ...AccountAddressFields
      }
      customer {
        ...AccountCustomerFields
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const CUSTOMER_ADDRESS_UPDATE_MUTATION = /* GraphQL */ `
  ${ACCOUNT_CUSTOMER_FRAGMENT}
  mutation CustomerAddressUpdate($id: ID!, $input: MailingAddressInput!) {
    customerAddressUpdate(id: $id, address: $input) {
      customerAddress {
        ...AccountAddressFields
      }
      customer {
        ...AccountCustomerFields
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const CUSTOMER_ADDRESS_DELETE_MUTATION = /* GraphQL */ `
  ${ACCOUNT_CUSTOMER_FRAGMENT}
  mutation CustomerAddressDelete($id: ID!) {
    customerAddressDelete(id: $id) {
      deletedCustomerAddressId
      customer {
        ...AccountCustomerFields
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`

export const CUSTOMER_DEFAULT_ADDRESS_MUTATION = /* GraphQL */ `
  ${ACCOUNT_CUSTOMER_FRAGMENT}
  mutation CustomerDefaultAddressUpdate($addressId: ID!) {
    customerDefaultAddressUpdate(addressId: $addressId) {
      customer {
        ...AccountCustomerFields
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`
