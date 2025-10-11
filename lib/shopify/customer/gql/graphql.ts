/* eslint-disable */
// This file is generated via `npm run codegen:customer`.
// Temporary checked-in scaffold so the app compiles in environments without schema access.
import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import { parse } from "graphql"

export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> }
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> }
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
  [_ in K]?: never
}
export type Incremental<T> = T | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

export type Scalars = {
  ID: { input: string; output: string }
  String: { input: string; output: string }
  Boolean: { input: boolean; output: boolean }
  Int: { input: number; output: number }
  Float: { input: number; output: number }
  DateTime: { input: string; output: string }
  URL: { input: string; output: string }
  UnsignedInt64: { input: number; output: number }
}

export type CurrencyCode = string

export type MoneyV2 = {
  __typename?: "MoneyV2"
  amount: string
  currencyCode: CurrencyCode
}

export type MailingAddress = {
  __typename?: "MailingAddress"
  address1?: Maybe<string>
  address2?: Maybe<string>
  city?: Maybe<string>
  country?: Maybe<string>
  id: string
  name?: Maybe<string>
  province?: Maybe<string>
  zip?: Maybe<string>
}

export type CustomerEmail = {
  __typename?: "CustomerEmail"
  emailAddress?: Maybe<string>
}

export type CustomerPhone = {
  __typename?: "CustomerPhone"
  number?: Maybe<string>
}

export type Customer = {
  __typename?: "Customer"
  addresses: {
    __typename?: "MailingAddressConnection"
    nodes: Array<MailingAddress>
  }
  creationDate: string
  defaultAddress?: Maybe<MailingAddress>
  displayName?: Maybe<string>
  emailAddress?: Maybe<CustomerEmail>
  firstName?: Maybe<string>
  id: string
  imageUrl?: Maybe<string>
  lastName?: Maybe<string>
  orders: {
    __typename?: "OrderConnection"
    nodes: Array<Order>
  }
  phoneNumber?: Maybe<CustomerPhone>
}

export type Order = {
  __typename?: "Order"
  createdAt: string
  currencyCode: CurrencyCode
  id: string
  name?: Maybe<string>
  processedAt?: Maybe<string>
  statusPageUrl?: Maybe<string>
  totalPrice?: Maybe<MoneyV2>
}

export type MeProfileQueryVariables = Exact<{ [key: string]: never }>

export type MeProfileQuery = {
  __typename?: "Query"
  customer?: Maybe<
    Pick<
      Customer,
      | "id"
      | "displayName"
      | "firstName"
      | "lastName"
      | "creationDate"
      | "imageUrl"
    > & {
      emailAddress?: Maybe<Pick<CustomerEmail, "emailAddress">>
      phoneNumber?: Maybe<Pick<CustomerPhone, "number">>
    }
  >
}

export type MeAddressesQueryVariables = Exact<{
  first: Scalars["Int"]["input"]
}>

export type MeAddressesQuery = {
  __typename?: "Query"
  customer?: Maybe<
    Pick<Customer, never> & {
      defaultAddress?: Maybe<Pick<MailingAddress, "id" | "name" | "address1" | "address2" | "city" | "province" | "country" | "zip">>
      addresses: {
        __typename?: "MailingAddressConnection"
        nodes: Array<Pick<MailingAddress, "id" | "name" | "address1" | "address2" | "city" | "province" | "country" | "zip">>
      }
    }
  >
}

export type MeOrdersQueryVariables = Exact<{
  first: Scalars["Int"]["input"]
}>

export type MeOrdersQuery = {
  __typename?: "Query"
  customer?: Maybe<
    Pick<Customer, never> & {
      orders: {
        __typename?: "OrderConnection"
        nodes: Array<
          Pick<Order, "id" | "name" | "createdAt" | "processedAt" | "currencyCode" | "statusPageUrl"> & {
            totalPrice?: Maybe<Pick<MoneyV2, "amount" | "currencyCode">>
          }
        >
      }
    }
  >
}

export const MeProfileDocument = parse(`
  query MeProfile {
    customer {
      id
      displayName
      firstName
      lastName
      creationDate
      imageUrl
      emailAddress {
        emailAddress
      }
      phoneNumber {
        number
      }
    }
  }
`) as unknown as DocumentNode<MeProfileQuery, MeProfileQueryVariables>
export const MeAddressesDocument = parse(`
  query MeAddresses($first: Int!) {
    customer {
      defaultAddress {
        id
        name
        address1
        address2
        city
        province
        country
        zip
      }
      addresses(first: $first) {
        nodes {
          id
          name
          address1
          address2
          city
          province
          country
          zip
        }
      }
    }
  }
`) as unknown as DocumentNode<MeAddressesQuery, MeAddressesQueryVariables>
export const MeOrdersDocument = parse(`
  query MeOrders($first: Int!) {
    customer {
      orders(first: $first) {
        nodes {
          id
          name
          createdAt
          processedAt
          currencyCode
          totalPrice {
            amount
            currencyCode
          }
          statusPageUrl
        }
      }
    }
  }
`) as unknown as DocumentNode<MeOrdersQuery, MeOrdersQueryVariables>
