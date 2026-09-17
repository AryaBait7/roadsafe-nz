import { createApp } from "./app";
import { FIXTURES_DIR } from "./data/fixtures";

const port = Number(process.env.PORT ?? 4000);

createApp().listen(port, () => {
  console.log(`RoadSafe NZ API on http://localhost:${port}`);
  console.log(`Reading aggregates from ${FIXTURES_DIR}`);
});
