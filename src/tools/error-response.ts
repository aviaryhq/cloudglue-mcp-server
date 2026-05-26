export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

export function jsonErrorResponse(payload: Record<string, unknown>) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
