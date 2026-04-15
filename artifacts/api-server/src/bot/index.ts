import {
  Client,
  GatewayIntentBits,
  Partials,
  Message,
  ActivityType,
} from "discord.js";
import { handleInteraction } from "./interactions.js";
import { handleConfigScrim } from "./flows/configscrim.js";
import { handleFinalizar, handleCargoAdd } from "./flows/prefix.js";
import { deployCommands } from "./deploy.js";
import { scheduleDelete } from "./utils.js";

const PREFIX = ".";

export async function startBot(token: string) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once("ready", async (c) => {
    console.log(`✅ Bot conectado como: ${c.user.tag}`);
    c.user.setActivity("SCRIM BOT 🎮", { type: ActivityType.Watching });

    await deployCommands(token, c.user.id);
  });

  client.on("interactionCreate", handleInteraction);

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args[0]?.toLowerCase();

    if (command === "configscrim") {
      await handleConfigScrim(message);
      return;
    }

    if (command === "finalizar") {
      await handleFinalizar(message);
      return;
    }

    if (command === "cargoadd") {
      await handleCargoAdd(message);
      return;
    }
  });

  await client.login(token);
  return client;
}
