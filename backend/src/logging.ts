// Avoid logging SQL messages/detail, request bodies, cookies, credentials or connection URLs.
export function logServerError(context: string, error: unknown): void {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    const safeCode = typeof code === "string" && /^[A-Z0-9_]{2,40}$/.test(code) ? code : "UNCLASSIFIED";
    console.error(context, { code: safeCode });
}
