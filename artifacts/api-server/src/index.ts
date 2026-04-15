import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./bot/index.js";

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
});

const discordToken = process.env["DISCORD_TOKEN"];
if (discordToken) {
  startBot(discordToken).catch((err) => {
    logger.error({ err }, "Failed to start Discord bot");
  });
} else {
  logger.warn("DISCORD_TOKEN not set — Discord bot will not start");
}
