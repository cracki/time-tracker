/**
 * Demo-mode gate (build-time inlined): when NEXT_PUBLIC_DEMO_MODE=1 at
 * build time the login screen shows the demo accounts and the Account
 * screen shows the offline-simulation toggle. Unset it for production —
 * since NEXT_PUBLIC_* vars are injected at build time, changing .env
 * requires a rebuild.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
