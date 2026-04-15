import {
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
  MessageFlags,
  PermissionFlagsBits,
  GuildMember,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { activeScrims, getGuildConfig, defaultGuildConfig } from "../state.js";

export async function handleCallSelect(interaction: StringSelectMenuInteraction) {
  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) {
    await interaction.reply({ content: "❌ Nenhuma scrim ativa.", flags: MessageFlags.Ephemeral });
    return;
  }

  const team = scrim.teams.find((t) => t.captainId === interaction.user.id);
  if (!team) {
    await interaction.reply({ content: "❌ Apenas o capitão pode configurar a call.", flags: MessageFlags.Ephemeral });
    return;
  }

  const action = interaction.values[0]!;

  if (action === "close_call") {
    team.callOpen = false;
    if (team.voiceChannelId) {
      try {
        const vc = guild.channels.cache.get(team.voiceChannelId);
        if (vc?.isVoiceBased()) {
          await vc.permissionOverwrites.edit(guild.roles.everyone.id, {
            Connect: false,
            ViewChannel: false,
          });
        }
      } catch {
      }
    }
    await interaction.update({
      embeds: [new EmbedBuilder().setTitle("⚙️ Config Call").setDescription("🔒 Call fechada com sucesso!").setColor(0xff4444)],
      components: [buildBackSelect()],
    });
    return;
  }

  if (action === "open_call") {
    team.callOpen = true;
    if (team.voiceChannelId) {
      try {
        const vc = guild.channels.cache.get(team.voiceChannelId);
        if (vc?.isVoiceBased()) {
          const overwrites: import("discord.js").OverwriteResolvable[] = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
          ];
          for (const uid of team.allowedUserIds) {
            if (uid !== interaction.user.id) {
              overwrites.push({ id: uid, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] });
            }
          }
          if (team.callOpen) {
            overwrites[0] = { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] };
          }
          await vc.permissionOverwrites.set(overwrites);
        }
      } catch {
      }
    }
    await interaction.update({
      embeds: [new EmbedBuilder().setTitle("⚙️ Config Call").setDescription("🔓 Call aberta com sucesso!").setColor(0x00c853)],
      components: [buildBackSelect()],
    });
    return;
  }

  if (action === "remove_player") {
    if (!team.voiceChannelId) {
      await interaction.update({
        embeds: [new EmbedBuilder().setTitle("⚙️ Config Call").setDescription("❌ Sua call não foi criada.").setColor(0xff4444)],
        components: [buildBackSelect()],
      });
      return;
    }

    try {
      const vc = guild.channels.cache.get(team.voiceChannelId);
      if (!vc?.isVoiceBased()) {
        await interaction.update({
          embeds: [new EmbedBuilder().setTitle("⚙️ Config Call").setDescription("❌ Canal de voz não encontrado.").setColor(0xff4444)],
          components: [buildBackSelect()],
        });
        return;
      }

      const members = [...vc.members.values()].filter((m) => m.id !== interaction.user.id);
      if (members.length === 0) {
        await interaction.update({
          embeds: [new EmbedBuilder().setTitle("⚙️ Config Call").setDescription("❌ Não há outros jogadores na call.").setColor(0xff4444)],
          components: [buildBackSelect()],
        });
        return;
      }

      const removeSelect = new StringSelectMenuBuilder()
        .setCustomId("call_rp_sel")
        .setPlaceholder("Selecione o jogador para remover")
        .addOptions(
          members.map((m) => ({
            label: m.displayName,
            value: m.id,
            emoji: "🗑️",
          }))
        );

      await interaction.update({
        embeds: [new EmbedBuilder().setTitle("🗑️ Remover Jogador").setDescription("Selecione quem deseja remover da call:").setColor(0xff4444)],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(removeSelect), buildBackSelect()],
      });
    } catch {
      await interaction.update({
        embeds: [new EmbedBuilder().setTitle("⚙️ Config Call").setDescription("❌ Erro ao listar jogadores.").setColor(0xff4444)],
        components: [buildBackSelect()],
      });
    }
    return;
  }

  if (action === "allow_player") {
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId("call_pp_sel")
      .setPlaceholder("Selecione o jogador para permitir")
      .setMinValues(1)
      .setMaxValues(1);

    await interaction.update({
      embeds: [new EmbedBuilder().setTitle("👤 Permitir Jogador").setDescription("Selecione o jogador que deseja permitir na call:").setColor(0x5865f2)],
      components: [
        new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect),
        buildBackSelect(),
      ],
    });
    return;
  }

  if (action === "limit_players") {
    const modal = new ModalBuilder()
      .setCustomId("modal_lp")
      .setTitle("🎚️ Limitar Jogadores");

    const limitInput = new TextInputBuilder()
      .setCustomId("limit_input")
      .setLabel("Quantidade máxima de jogadores")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder("Ex: 5");

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(limitInput));
    await interaction.showModal(modal);
    return;
  }
}

export async function handleCallRemovePlayer(interaction: StringSelectMenuInteraction) {
  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) return;

  const team = scrim.teams.find((t) => t.captainId === interaction.user.id);
  if (!team) return;

  const targetId = interaction.values[0]!;

  try {
    const vc = guild.channels.cache.get(team.voiceChannelId);
    if (vc?.isVoiceBased()) {
      const member = vc.members.get(targetId);
      if (member) await member.voice.disconnect("Removido pelo capitão");
      await vc.permissionOverwrites.delete(targetId);
    }
    team.allowedUserIds = team.allowedUserIds.filter((id) => id !== targetId);
  } catch {
  }

  await interaction.update({
    embeds: [new EmbedBuilder().setTitle("✅ Jogador Removido").setDescription("O jogador foi removido da call.").setColor(0x00c853)],
    components: [buildBackSelect()],
  });
}

export async function handleCallAllowPlayer(interaction: UserSelectMenuInteraction) {
  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) return;

  const team = scrim.teams.find((t) => t.captainId === interaction.user.id);
  if (!team) return;

  const targetId = interaction.values[0]!;
  if (!team.allowedUserIds.includes(targetId)) {
    team.allowedUserIds.push(targetId);
  }

  try {
    const vc = guild.channels.cache.get(team.voiceChannelId);
    if (vc?.isVoiceBased()) {
      await vc.permissionOverwrites.edit(targetId, {
        Connect: true,
        ViewChannel: true,
      });
    }
  } catch {
  }

  const member = guild.members.cache.get(targetId);
  await interaction.update({
    embeds: [
      new EmbedBuilder()
        .setTitle("✅ Jogador Permitido")
        .setDescription(`**${member?.displayName ?? targetId}** agora pode entrar na call.`)
        .setColor(0x00c853),
    ],
    components: [buildBackSelect()],
  });
}

export async function handleLimitPlayersModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== "modal_lp") return false;

  const guild = interaction.guild!;
  const scrim = activeScrims.get(guild.id);
  if (!scrim) return true;

  const team = scrim.teams.find((t) => t.captainId === interaction.user.id);
  if (!team) return true;

  const limitStr = interaction.fields.getTextInputValue("limit_input");
  const limit = parseInt(limitStr, 10);

  if (isNaN(limit) || limit < 1) {
    await interaction.reply({ content: "❌ Número inválido.", flags: MessageFlags.Ephemeral });
    return true;
  }

  team.maxMembers = limit;

  try {
    const vc = guild.channels.cache.get(team.voiceChannelId);
    if (vc?.isVoiceBased()) {
      await vc.edit({ userLimit: limit });
    }
  } catch {
  }

  await interaction.reply({
    content: `✅ Limite de jogadores definido para **${limit}**.`,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

function buildBackSelect() {
  const select = new StringSelectMenuBuilder()
    .setCustomId("call_select")
    .setPlaceholder("⚙️ Voltar ao menu principal")
    .addOptions(
      { label: "Remover jogador", value: "remove_player", emoji: "🗑️" },
      { label: "Fechar call", value: "close_call", emoji: "🔒" },
      { label: "Abrir call", value: "open_call", emoji: "🔓" },
      { label: "Permitir jogador", value: "allow_player", emoji: "👤" },
      { label: "Limitar jogadores", value: "limit_players", emoji: "🎚️" }
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}
