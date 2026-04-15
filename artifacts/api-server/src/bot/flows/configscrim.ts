import {
  Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  RoleSelectMenuBuilder,
  RoleSelectMenuInteraction,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
  MessageFlags,
  ChannelType,
} from "discord.js";
import {
  configScrimSessions,
  getGuildConfig,
  setGuildConfig,
  defaultGuildConfig,
} from "../state.js";
import { scheduleDelete, AUTO_DELETE_MS, isAdmin } from "../utils.js";

export async function handleConfigScrim(message: Message) {
  const guild = message.guild!;
  const guildConfig = getGuildConfig(guild.id) ?? defaultGuildConfig();

  if (!isAdmin(guildConfig, message.author.id, guild.ownerId)) {
    const reply = await message.reply("❌ Você não tem permissão para usar este comando.");
    scheduleDelete(reply);
    return;
  }

  try { await message.delete(); } catch {}

  configScrimSessions.set(message.author.id, { guildId: guild.id, channelId: message.channelId });

  const embed = buildConfigEmbed(guildConfig);
  const components = buildConfigComponents();

  const msg = await (message.channel as import("discord.js").TextChannel).send({ embeds: [embed], components });
  scheduleDelete(msg);

  const session = configScrimSessions.get(message.author.id)!;
  session.sessionMsgId = msg.id;
}

function buildConfigEmbed(cfg: ReturnType<typeof getGuildConfig> extends null ? never : NonNullable<ReturnType<typeof getGuildConfig>>) {
  return new EmbedBuilder()
    .setTitle("⚙️ Configuração do Bot de Scrim")
    .setColor(0x5865f2)
    .addFields(
      { name: "🏢 Nome da ORG", value: cfg.orgName || "Não definido", inline: true },
      { name: "📁 Categoria", value: cfg.categoryId ? `<#${cfg.categoryId}>` : "Não definida", inline: true },
      { name: "👑 Cargo Capitão", value: cfg.captainRoleId ? `<@&${cfg.captainRoleId}>` : "Não definido", inline: true },
      { name: "🎖️ Cargo de Scrim", value: cfg.scrimRoleId ? `<@&${cfg.scrimRoleId}>` : "Não definido", inline: true },
      { name: "🛡️ Admins", value: cfg.adminIds.length > 0 ? cfg.adminIds.map((id) => `<@${id}>`).join(", ") : "Nenhum", inline: true },
      { name: "⚙️ Config da Sala", value: cfg.roomConfig || "Não definida", inline: false },
      { name: "📜 Regras", value: cfg.rules.length > 0 ? cfg.rules.map((r) => `🚫 ${r}`).join("\n") : "Nenhuma", inline: false }
    );
}

function buildConfigComponents() {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("cfg_orgname_btn").setLabel("Nome ORG").setEmoji("🏢").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("cfg_cat_btn").setLabel("Categoria").setEmoji("📁").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("cfg_caprole_btn").setLabel("Cargo Capitão").setEmoji("👑").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("cfg_scrimrole_btn").setLabel("Cargo Scrim").setEmoji("🎖️").setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("cfg_admin_btn").setLabel("Adicionar ADM").setEmoji("🛡️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("cfg_sala_btn").setLabel("Config da Sala").setEmoji("⚙️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("cfg_rules_btn").setLabel("Editar Regras").setEmoji("📜").setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

export async function handleCfgOrgNameBtn(interaction: ButtonInteraction) {
  const session = configScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada. Use .configscrim novamente.", flags: MessageFlags.Ephemeral });
    return;
  }
  const modal = new ModalBuilder().setCustomId("modal_cfg_org").setTitle("🏢 Nome da Organização");
  const input = new TextInputBuilder()
    .setCustomId("org_name_input")
    .setLabel("Nome da ORG (ex: PRIME RUSH)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(50);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleCfgOrgNameModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== "modal_cfg_org") return false;
  const orgName = interaction.fields.getTextInputValue("org_name_input").trim();
  const guild = interaction.guild!;
  const cfg = getGuildConfig(guild.id) ?? defaultGuildConfig();
  cfg.orgName = orgName;
  setGuildConfig(guild.id, cfg);
  await interaction.reply({ content: `✅ Nome da ORG definido para **${orgName}**.`, flags: MessageFlags.Ephemeral });
  await refreshConfigMsg(interaction, cfg);
  return true;
}

export async function handleCfgCatBtn(interaction: ButtonInteraction) {
  const guild = interaction.guild!;
  await guild.channels.fetch();
  const categories = guild.channels.cache.filter((ch) => ch.type === ChannelType.GuildCategory);

  if (categories.size === 0) {
    await interaction.reply({ content: "❌ Nenhuma categoria encontrada no servidor.", flags: MessageFlags.Ephemeral });
    return;
  }

  const options = [...categories.values()].slice(0, 25).map((cat) => ({
    label: cat.name,
    value: cat.id,
    emoji: "📁",
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId("cfg_cat_sel")
    .setPlaceholder("Selecione a categoria para as calls")
    .addOptions(options);

  const reply = await interaction.reply({
    content: "📁 Selecione a categoria onde as calls serão criadas:",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCfgCatSelect(interaction: StringSelectMenuInteraction) {
  const guild = interaction.guild!;
  const cfg = getGuildConfig(guild.id) ?? defaultGuildConfig();
  cfg.categoryId = interaction.values[0]!;
  setGuildConfig(guild.id, cfg);
  const cat = guild.channels.cache.get(cfg.categoryId);
  await interaction.update({ content: `✅ Categoria definida para **${cat?.name ?? cfg.categoryId}**.`, components: [] });
  await refreshConfigMsg(interaction, cfg);
}

export async function handleCfgCapRoleBtn(interaction: ButtonInteraction) {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("cfg_caprole_sel")
    .setPlaceholder("Selecione o cargo de Capitão");

  await interaction.reply({
    content: "👑 Selecione o cargo de Capitão:",
    components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCfgCapRoleSelect(interaction: RoleSelectMenuInteraction) {
  const guild = interaction.guild!;
  const cfg = getGuildConfig(guild.id) ?? defaultGuildConfig();
  cfg.captainRoleId = interaction.values[0]!;
  setGuildConfig(guild.id, cfg);
  await interaction.update({ content: `✅ Cargo de Capitão definido para <@&${cfg.captainRoleId}>.`, components: [] });
  await refreshConfigMsg(interaction, cfg);
}

export async function handleCfgScrimRoleBtn(interaction: ButtonInteraction) {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("cfg_scrimrole_sel")
    .setPlaceholder("Selecione o cargo de Scrim (dado aos CPTs)");

  await interaction.reply({
    content: "🎖️ Selecione o cargo que será dado aos capitães ao entrar na scrim:",
    components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCfgScrimRoleSelect(interaction: RoleSelectMenuInteraction) {
  const guild = interaction.guild!;
  const cfg = getGuildConfig(guild.id) ?? defaultGuildConfig();
  cfg.scrimRoleId = interaction.values[0]!;
  setGuildConfig(guild.id, cfg);
  await interaction.update({ content: `✅ Cargo de Scrim definido para <@&${cfg.scrimRoleId}>.`, components: [] });
  await refreshConfigMsg(interaction, cfg);
}

export async function handleCfgAdminBtn(interaction: ButtonInteraction) {
  const userSelect = new UserSelectMenuBuilder()
    .setCustomId("cfg_admin_sel")
    .setPlaceholder("Selecione o admin a adicionar")
    .setMinValues(1)
    .setMaxValues(1);

  await interaction.reply({
    content: "🛡️ Selecione o usuário para adicionar como admin do bot:",
    components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCfgAdminSelect(interaction: UserSelectMenuInteraction) {
  const guild = interaction.guild!;
  const cfg = getGuildConfig(guild.id) ?? defaultGuildConfig();
  const userId = interaction.values[0]!;
  if (!cfg.adminIds.includes(userId)) cfg.adminIds.push(userId);
  setGuildConfig(guild.id, cfg);
  await interaction.update({ content: `✅ <@${userId}> adicionado como admin do bot.`, components: [] });
  await refreshConfigMsg(interaction, cfg);
}

export async function handleCfgSalaBtn(interaction: ButtonInteraction) {
  const session = configScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada. Use .configscrim novamente.", flags: MessageFlags.Ephemeral });
    return;
  }
  const guild = interaction.guild!;
  const cfg = getGuildConfig(guild.id) ?? defaultGuildConfig();
  const modal = new ModalBuilder().setCustomId("modal_cfg_sala").setTitle("⚙️ Config da Sala Padrão");
  const input = new TextInputBuilder()
    .setCustomId("sala_input")
    .setLabel("Configuração padrão da sala")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setValue(cfg.roomConfig)
    .setPlaceholder("Ex: ID: 123 | Senha: abc");
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleCfgSalaModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== "modal_cfg_sala") return false;
  const guild = interaction.guild!;
  const cfg = getGuildConfig(guild.id) ?? defaultGuildConfig();
  cfg.roomConfig = interaction.fields.getTextInputValue("sala_input").trim();
  setGuildConfig(guild.id, cfg);
  await interaction.reply({ content: "✅ Configuração da sala atualizada.", flags: MessageFlags.Ephemeral });
  await refreshConfigMsg(interaction, cfg);
  return true;
}

export async function handleCfgRulesBtn(interaction: ButtonInteraction) {
  const session = configScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada. Use .configscrim novamente.", flags: MessageFlags.Ephemeral });
    return;
  }
  const guild = interaction.guild!;
  const cfg = getGuildConfig(guild.id) ?? defaultGuildConfig();
  const modal = new ModalBuilder().setCustomId("modal_cfg_rules").setTitle("📜 Regras da Scrim");

  const inputs = [
    new TextInputBuilder().setCustomId("rule1").setLabel("Regra 1").setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.rules[0] ?? ""),
    new TextInputBuilder().setCustomId("rule2").setLabel("Regra 2").setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.rules[1] ?? ""),
    new TextInputBuilder().setCustomId("rule3").setLabel("Regra 3").setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.rules[2] ?? ""),
    new TextInputBuilder().setCustomId("rule4").setLabel("Regra 4").setStyle(TextInputStyle.Short).setRequired(false).setValue(cfg.rules[3] ?? ""),
  ];

  for (const input of inputs) {
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }
  await interaction.showModal(modal);
}

export async function handleCfgRulesModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== "modal_cfg_rules") return false;
  const guild = interaction.guild!;
  const cfg = getGuildConfig(guild.id) ?? defaultGuildConfig();

  const rules: string[] = [];
  for (const key of ["rule1", "rule2", "rule3", "rule4"]) {
    const val = interaction.fields.getTextInputValue(key).trim();
    if (val) rules.push(val);
  }
  cfg.rules = rules;
  setGuildConfig(guild.id, cfg);
  await interaction.reply({
    content: `✅ Regras atualizadas (${rules.length} regras salvas).\n${rules.map((r) => `🚫 ${r}`).join("\n")}`,
    flags: MessageFlags.Ephemeral,
  });
  await refreshConfigMsg(interaction, cfg);
  return true;
}

async function refreshConfigMsg(
  interaction: ButtonInteraction | StringSelectMenuInteraction | RoleSelectMenuInteraction | UserSelectMenuInteraction | ModalSubmitInteraction,
  cfg: ReturnType<typeof defaultGuildConfig>
) {
  try {
    const session = configScrimSessions.get(interaction.user.id);
    if (!session?.sessionMsgId) return;
    const ch = interaction.guild?.channels.cache.get(session.channelId);
    if (!ch?.isTextBased()) return;
    const msg = await ch.messages.fetch(session.sessionMsgId);
    if (msg) {
      await msg.edit({ embeds: [buildConfigEmbed(cfg)], components: buildConfigComponents() });
    }
  } catch {}
}
