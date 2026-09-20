import serverlessExpress from "@codegenie/serverless-express";
import { createApp } from "./app";

/**
 * Lambda entry point.
 *
 * The same Express app the local server runs — `createApp()` is untouched, so
 * there is exactly one API and the tests that cover it cover what is
 * deployed. Only the transport differs: `server.ts` binds a port, this hands
 * the app a Function URL event instead.
 *
 * The app is built once, outside the handler. Lambda keeps a warm container
 * between invocations, so everything at module scope — including the fixture
 * cache in `data/fixtures.ts` — is paid for on the first request and reused
 * by the rest. Building it inside the handler would re-parse the 5.9MB cube
 * on every call.
 */
const handler = serverlessExpress({ app: createApp() });

export { handler };
