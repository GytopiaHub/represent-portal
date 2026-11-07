// What every Server Action returns. Lives outside src/server so client
// components can import the type.

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };
