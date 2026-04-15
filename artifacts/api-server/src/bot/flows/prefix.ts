import { Message, TextChannel } from "discord.js";
import { activeScrims, getGuildConfig, defaultGuildConfig } from "../state.js";
import { scheduleDelete, isAdmin } from "../utils.js";

function ch(message: Message) {
  return message.channel as TextChannel;
}

export async function handleFinalizar(message: Message) {
  const guild = message.guild!;
  const scrim = activeScrims.get(guild.id);
  const guildConfig = getGuildConfig(guild.id) ?? defaultGuildConfig();

  if (!isAdmin(guildConfig, message.author.id, guild.ownerId)) {
    const reply = await message.reply("❌ Você não tem permissão para usar este comando.");
    scheduleDelete(reply);
    try { await message.delete(); } catch {}
    return;
  }

  try { await message.delete(); } catch {}

  if (!scrim) {
    const reply = await ch(message).send("❌ Nenhuma scrim ativa para finalizar.");
    scheduleDelete(reply);
    return;
  }

  if (scrim.confirmationTimerId) clearTimeout(scrim.confirmationTimerId);
  if (scrim.idSenhaTimerId) clearTimeout(scrim.idSenhaTimerId);

  for (const team of scrim.teams) {
    if (team.voiceChannelId) {
      try {
        const vc = guild.channels.cache.get(team.voiceChannelId);
        if (vc) await vc.delete("Scrim finalizada");
      } catch {}
    }
  }

  if (scrim.idSenhaChannelId) {
    try {
      const idCh = guild.channels.cache.get(scrim.idSenhaChannelId);
      if (idCh) await idCh.delete("Scrim finalizada");
    } catch {}
  }

  if (scrim.createdRoleId) {
    try {
      const role = guild.roles.cache.get(scrim.createdRoleId);
      if (role) await role.delete("Scrim finalizada");
    } catch {}
  }

  try {
    const panelCh = guild.channels.cache.get(scrim.panelChannelId);
    if (panelCh?.isTextBased()) {
      const panelMsg = await (panelCh as TextChannel).messages.fetch(scrim.panelMessageId);
      if (panelMsg) await panelMsg.delete();
    }
  } catch {}

  activeScrims.delete(guild.id);

  const reply = await ch(message).send("✅ Scrim finalizada! Todas as calls e canais foram removidos.");
  scheduleDelete(reply);
}

export async function handleCargoAdd(message: Message) {
  const guild = message.guild!;
  const guildConfig = getGuildConfig(guild.id) ?? defaultGuildConfig();

  if (!isAdmin(guildConfig, message.author.id, guild.ownerId)) {
    const reply = await message.reply("❌ Você não tem permissão para usar este comando.");
    scheduleDelete(reply);
    try { await message.delete(); } catch {}
    return;
  }

  try { await message.delete(); } catch {}

  const mentions = message.mentions.users;
  if (mentions.size === 0) {
    const reply = await ch(message).send("❌ Uso correto: `.cargoadd @usuario`");
    scheduleDelete(reply);
    return;
  }

  const scrim = activeScrims.get(guild.id);

  if (!guildConfig.scrimRoleId) {
    const reply = await ch(message).send("❌ Cargo de scrim não configurado. Use `.configscrim` primeiro.");
    scheduleDelete(reply);
    return;
  }

  const results: string[] = [];
  for (const [userId] of mentions) {
    try {
      const member = await guild.members.fetch(userId);
      await member.roles.add(guildConfig.scrimRoleId);
      if (scrim?.createdRoleId) await member.roles.add(scrim.createdRoleId);
      results.push(`✅ <@${userId}> recebeu o cargo.`);
    } catch {
      results.push(`❌ Não foi possível dar o cargo para <@${userId}>.`);
    }
  }

  const reply = await ch(message).send(results.join("\n"));
  scheduleDelete(reply);
}
