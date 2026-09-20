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
};

export default nextConfig;
