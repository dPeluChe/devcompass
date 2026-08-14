/**
 * The demo-mode sentinel token. Lives in its own tiny module so production
 * code can check `token === DEMO_TOKEN` without statically importing the
 * demo fixture payloads (~700 LOC) — those load lazily only in demo mode.
 */
export const DEMO_TOKEN = '__demo__'
