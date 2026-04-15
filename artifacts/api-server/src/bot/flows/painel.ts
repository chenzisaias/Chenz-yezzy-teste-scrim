import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  GuildMember,
} from "discord.js";
import { activeScrims, getGuildConfig, defaultGuildConfig } from "../state.js";
import type { Team } from "../types.js";
import { buildPanelEmbed, buildPanelComponents, refreshPanel, scheduleDelete } from "../utils.js";

export async function handlePanelEnter(interaction: ButtonInteraction) {
  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) {
    await interaction.reply({ content: "❌ Nenhuma scrim ativa.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (scrim.teams.length >= scrim.maxTeams) {
    await interaction.reply({ content: "❌ A scrim está lotada!", flags: MessageFlags.Ephemeral });
    return;
  }

  const existingTeam = scrim.teams.find((t) => t.captainId === interaction.user.id);
  if (existingTeam) {
    await interaction.reply({ content: `❌ Você já está inscrito com o time **${existingTeam.name}**.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder().setCustomId("modal_entrar").setTitle("🎮 Entrar com Time");
  const nameInput = new TextInputBuilder()
    .setCustomId("team_name_input")
    .setLabel("Nome do seu time")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));
  await interaction.showModal(modal);
}

export async function handlePanelEnterModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== "modal_entrar") return false;

  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) {
    await interaction.reply({ content: "❌ Nenhuma scrim ativa.", flags: MessageFlags.Ephemeral });
    return true;
  }

  const teamName = interaction.fields.getTextInputValue("team_name_input").trim();
  const guildConfig = getGuildConfig(guild.id) ?? defaultGuildConfig();

  const duplicate = scrim.teams.find(
    (t) => t.name.toLowerCase() === teamName.toLowerCase()
  );
  if (duplicate) {
    await interaction.reply({ content: `❌ Já existe um time com o nome **${teamName}**.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (scrim.teams.length >= scrim.maxTeams) {
    await interaction.reply({ content: "❌ A scrim está lotada!", flags: MessageFlags.Ephemeral });
    return true;
  }

  const existingTeam = scrim.teams.find((t) => t.captainId === interaction.user.id);
  if (existingTeam) {
    await interaction.reply({ content: `❌ Você já está inscrito com o time **${existingTeam.name}**.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  const slotIndex = findFreeSlot(scrim.teams, scrim.maxTeams);
  if (slotIndex === -1) {
    await interaction.reply({ content: "❌ Sem slots disponíveis.", flags: MessageFlags.Ephemeral });
    return true;
  }

  let voiceChannelId = "";
  try {
    const overwrites: import("discord.js").OverwriteResolvable[] = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.MuteMembers] },
    ];

    const vc = await guild.channels.create({
      name: `🎮 • ${teamName}`,
      type: ChannelType.GuildVoice,
      parent: guildConfig.categoryId || undefined,
      permissionOverwrites: overwrites,
      reason: `Call do time ${teamName}`,
    });
    voiceChannelId = vc.id;
  } catch {
  }

  const team: Team = {
    name: teamName,
    captainId: interaction.user.id,
    slotIndex,
    voiceChannelId,
    confirmed: false,
    callOpen: false,
    maxMembers: null,
    allowedUserIds: [interaction.user.id],
  };

  scrim.teams.push(team);

  const member = interaction.member as GuildMember;
  try {
    if (scrim.createdRoleId) await member.roles.add(scrim.createdRoleId);
    if (guildConfig.scrimRoleId) await member.roles.add(guildConfig.scrimRoleId);
  } catch {
  }

  const orgName = guildConfig.orgName;
  await refreshPanel(guild, scrim, orgName);

  await interaction.reply({
    content: `✅ Time **${teamName}** inscrito no **SLOT ${slotIndex + 1}**! Sua call foi criada.`,
    flags: MessageFlags.Ephemeral,
  });

  return true;
}

function findFreeSlot(teams: Team[], max: number): number {
  const usedSlots = new Set(teams.map((t) => t.slotIndex));
  for (let i = 0; i < max; i++) {
    if (!usedSlots.has(i)) return i;
  }
  return -1;
}

export async function handlePanelLeave(interaction: ButtonInteraction) {
  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) {
    await interaction.reply({ content: "❌ Nenhuma scrim ativa.", flags: MessageFlags.Ephemeral });
    return;
  }

  const teamIdx = scrim.teams.findIndex((t) => t.captainId === interaction.user.id);
  if (teamIdx === -1) {
    await interaction.reply({ content: "❌ Você não está inscrito como capitão de nenhum time.", flags: MessageFlags.Ephemeral });
    return;
  }

  const team = scrim.teams[teamIdx]!;
  scrim.teams.splice(teamIdx, 1);

  if (team.voiceChannelId) {
    try {
      const vc = guild.channels.cache.get(team.voiceChannelId);
      if (vc) await vc.delete("Time saiu da scrim");
    } catch {
    }
  }

  const member = interaction.member as GuildMember;
  const guildConfig = getGuildConfig(guild.id) ?? defaultGuildConfig();
  try {
    if (scrim.createdRoleId) await member.roles.remove(scrim.createdRoleId);
    if (guildConfig.scrimRoleId) await member.roles.remove(guildConfig.scrimRoleId);
  } catch {
  }

  await refreshPanel(guild, scrim, guildConfig.orgName);
  await interaction.reply({
    content: `✅ Time **${team.name}** removido da scrim.`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handlePanelCallCfg(interaction: ButtonInteraction) {
  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) {
    await interaction.reply({ content: "❌ Nenhuma scrim ativa.", flags: MessageFlags.Ephemeral });
    return;
  }

  const team = scrim.teams.find((t) => t.captainId === interaction.user.id);
  if (!team) {
    await interaction.reply({ content: "❌ Apenas o capitão do time pode acessar o Config Call.", flags: MessageFlags.Ephemeral });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("call_select")
    .setPlaceholder("⚙️ Escolha uma ação para a call")
    .addOptions(
      { label: "Remover jogador", value: "remove_player", emoji: "🗑️" },
      { label: "Fechar call", value: "close_call", emoji: "🔒" },
      { label: "Abrir call", value: "open_call", emoji: "🔓" },
      { label: "Permitir jogador", value: "allow_player", emoji: "👤" },
      { label: "Limitar jogadores", value: "limit_players", emoji: "🎚️" }
    );

  const embed = new EmbedBuilder()
    .setTitle(`⚙️ Config Call — ${team.name}`)
    .setDescription("Selecione uma ação para gerenciar sua call:")
    .setColor(0x5865f2);

  const reply = await interaction.reply({
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleConfirmYes(interaction: ButtonInteraction) {
  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) {
    await interaction.reply({ content: "❌ Nenhuma scrim ativa.", flags: MessageFlags.Ephemeral });
    return;
  }

  const team = scrim.teams.find((t) => t.captainId === interaction.user.id);
  if (!team) {
    await interaction.reply({ content: "❌ Você não é capitão de nenhum time nesta scrim.", flags: MessageFlags.Ephemeral });
    return;
  }

  team.confirmed = true;
  const guildConfig = getGuildConfig(guild.id) ?? defaultGuildConfig();
  await refreshPanel(guild, scrim, guildConfig.orgName);
  await interaction.reply({ content: "✅ Presença confirmada!", flags: MessageFlags.Ephemeral });
}

export async function handleConfirmNo(interaction: ButtonInteraction) {
  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) {
    await interaction.reply({ content: "❌ Nenhuma scrim ativa.", flags: MessageFlags.Ephemeral });
    return;
  }

  const teamIdx = scrim.teams.findIndex((t) => t.captainId === interaction.user.id);
  if (teamIdx === -1) {
    await interaction.reply({ content: "❌ Você não é capitão de nenhum time nesta scrim.", flags: MessageFlags.Ephemeral });
    return;
  }

  const team = scrim.teams[teamIdx]!;
  scrim.teams.splice(teamIdx, 1);

  if (team.voiceChannelId) {
    try {
      const vc = guild.channels.cache.get(team.voiceChannelId);
      if (vc) await vc.delete("Time cancelou participação");
    } catch {
    }
  }

  const member = interaction.member as GuildMember;
  const guildConfig = getGuildConfig(guild.id) ?? defaultGuildConfig();
  try {
    if (scrim.createdRoleId) await member.roles.remove(scrim.createdRoleId);
    if (guildConfig.scrimRoleId) await member.roles.remove(guildConfig.scrimRoleId);
  } catch {
  }

  await refreshPanel(guild, scrim, guildConfig.orgName);
  await interaction.reply({ content: `✅ Participação cancelada. Time **${team.name}** removido.`, flags: MessageFlags.Ephemeral });
}
