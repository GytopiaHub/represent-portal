/** Postgres unique_violation (23505), e.g. a dance position that was just filled. */
export function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}
