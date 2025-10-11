export class DiscoveryError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = "DiscoveryError"
  }
}

export class AuthExpiredError extends Error {
  constructor(message = "Customer authentication expired") {
    super(message)
    this.name = "AuthExpiredError"
  }
}

export class GraphQLErrorWithStatus extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: unknown,
    public readonly url?: string,
  ) {
    super(message)
    this.name = "GraphQLErrorWithStatus"
  }
}

export class CustomerApiError extends GraphQLErrorWithStatus {
  constructor(
    message: string,
    status: number,
    errors?: unknown,
    url?: string,
  ) {
    super(message, status, errors, url)
    this.name = "CustomerApiError"
  }
}
