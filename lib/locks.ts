// Postgres advisory-lock keys. Any transaction that can change who is an
// active admin takes ADMIN_SET_LOCK first, so the bootstrap rule (R-ROLE-3)
// and the last-admin rule (R-ROLE-4) can't race each other.
export const ADMIN_SET_LOCK = 4_177_001;
