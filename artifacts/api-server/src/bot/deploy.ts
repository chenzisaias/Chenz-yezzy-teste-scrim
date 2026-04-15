import { REST, Routes, SlashCommandBuilder } from "discord.js";

export async function deployCommands(token: string, clientId: string) {
  const commands = [
    new SlashCommandBuilder()
      .setName("criarscrim")
      .setDescription("Criar uma nova scrim competitiva")
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("✅ Slash commands registrados globalmente.");
  } catch (err) {
    console.error("Erro ao registrar comandos:", err);
  }
}
