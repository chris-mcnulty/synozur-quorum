import app from "./app";
import { logger } from "./lib/logger";
import { startRefreshScheduler } from "./lib/grounding";
import { startCadenceScheduler } from "./lib/cadenceScheduler";
import { ensureLocalUsersSeeded } from "./lib/localAuth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startRefreshScheduler();
  startCadenceScheduler();

  ensureLocalUsersSeeded().catch((err) => {
    logger.error({ err }, "Failed to seed local users");
  });
});
