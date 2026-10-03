import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Required by Amplify Hosting's SSR runtime, and by any serverless or
   * container target: it emits `.next/standalone`, a self-contained server
   * with only the dependencies the app actually traces, rather than assuming
   * `node_modules` will be sitting next to it at runtime.
   *
   * Without it the deploy succeeds and every route then answers 500, because
   * there is no server bundle for the compute to run. `next dev` and
   * `next start` are unaffected.
   */
  output: "standalone",

  /**
   * Bake the API origin into the build.
   *
   * Amplify exposes an app's environment variables to the *build* container,
   * but they do not reliably reach the *SSR runtime* that serves requests. The
   * symptom is precise and was exactly what we saw: static routes and assets
   * serve normally, every data-backed page answers 500, because at render time
   * `process.env.API_BASE_URL` is undefined and the client falls back to
   * `http://localhost:4000` — which does not exist inside the compute.
   *
   * Inlining is safe here specifically because this value is a public API
   * endpoint, not a secret. A credential must never go through `env`: it would
   * be compiled into the client bundle too.
   *
   * Spread conditionally so a local build without the variable set keeps the
   * `?? "http://localhost:4000"` default in `services/http.ts` rather than
   * inlining `undefined` over it.
   */
  ...(process.env.API_BASE_URL
    ? { env: { API_BASE_URL: process.env.API_BASE_URL } }
    : {}),
};

export default nextConfig;
