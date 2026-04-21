import { StatusCodes } from "http-status-codes";

export class AppError extends Error {
  readonly isBusinessError = true;

  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isBusinessError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "isBusinessError" in error &&
    (error as { isBusinessError?: unknown }).isBusinessError === true &&
    "message" in error
  );
}

export class InvalidOrganizationMembersError extends AppError {
  constructor(readonly missingUserIds: string[]) {
    super(
      "One or more member users do not exist",
      StatusCodes.BAD_REQUEST,
      "INVALID_ORGANIZATION_MEMBERS",
      { missingUserIds }
    );
    this.name = "InvalidOrganizationMembersError";
  }
}
