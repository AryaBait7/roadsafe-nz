import type { NextConfig } from "next";

/**
 * Deliberately empty.
 *
 * Two settings used to live here and both were workarounds for Amplify
 * Hosting, which this project no longer uses:
 *
 *   output: "standalone"   — Amplify's SSR runtime needed a self-contained
 *                            server bundle. Vercel builds Next through its
 *                            own output pipeline and does not.
 *   env: { API_BASE_URL }  — Amplify passed environment variables to the
 *                            build but not to the SSR runtime, so the origin
 *                            had to be inlined at compile time. Vercel passes
 *                            them to the runtime, which the first deployment
 *                            here proved before this workaround was ever
 *                            pushed.
 *
 * `API_BASE_URL` is read once, at runtime, in `services/http.ts`. Keeping it
 * out of the build means changing it in Vercel takes effect without a
 * rebuild, and it never reaches the client bundle.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
