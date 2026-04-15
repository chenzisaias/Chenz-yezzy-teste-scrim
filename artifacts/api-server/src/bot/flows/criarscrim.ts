import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
  Guild,
  OverwriteType,
} from "discord.js";
import {
  criarScrimSessions,
  activeScrims,
  getGuildConfig,
  defaultGuildConfig,
} from "../state.js";
import type { CriarScrimSession, ActiveScrim, Team } from "../types.js";
import {
  buildPanelEmbed,
  buildPanelComponents,
  parseTime,
  buildConfirmRulesSelect,
  scheduleDelete,
  AUTO_DELETE_MS,
} from "../utils.js";

export async function handleCriarScrim(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("modal_cs_time")
    .setTitle("⏱️ Horário da Scrim");

  const timeInput = new TextInputBuilder()
    .setCustomId("cs_time_input")
    .setLabel("Horário (ex: 20:00)")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder("20:00");

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput));
  await interaction.showModal(modal);
}

export async function handleCriarScrimModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== "modal_cs_time") return false;

  const timeRaw = interaction.fields.getTextInputValue("cs_time_input");
  const parsed = parseTime(timeRaw);
  if (!parsed) {
    await interaction.reply({
      content: "❌ Horário inválido. Use o formato **HH:MM** (ex: 20:00).",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const session: CriarScrimSession = {
    guildId: interaction.guildId!,
    channelId: interaction.channelId!,
    time: timeRaw.trim(),
    step: "selects",
  };
  criarScrimSessions.set(interaction.user.id, session);

  const teamsSelect = new StringSelectMenuBuilder()
    .setCustomId("cs_teams")
    .setPlaceholder("👥 Quantidade de times")
    .addOptions(
      Array.from({ length: 8 }, (_, i) => ({
        label: `${i + 8} times`,
        value: `${i + 8}`,
      }))
    );

  const modeSelect = new StringSelectMenuBuilder()
    .setCustomId("cs_mode")
    .setPlaceholder("🎮 Modo da scrim")
    .addOptions(
      { label: "📱 Full Mobile", value: "mobile" },
      { label: "🔀 Misto", value: "misto" },
      { label: "💻 Emulador", value: "emulador" }
    );

  const confirmSelect = new StringSelectMenuBuilder()
    .setCustomId("cs_ctime")
    .setPlaceholder("⏱️ Tempo de confirmação")
    .addOptions(
      { label: "15 minutos", value: "15" },
      { label: "30 minutos", value: "30" },
      { label: "1 hora", value: "60" }
    );

  const nextBtn = new ButtonBuilder()
    .setCustomId("cs_next1")
    .setLabel("Próximo ➡️")
    .setStyle(ButtonStyle.Primary);

  const embed = new EmbedBuilder()
    .setTitle("🎮 Configurar Scrim")
    .setDescription(`**🕒 Horário:** ${timeRaw.trim()}\n\nConfigure os campos abaixo e clique em **Próximo**.`)
    .setColor(0x5865f2);

  const msg = await interaction.reply({
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(teamsSelect),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(modeSelect),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(confirmSelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(nextBtn),
    ],
    flags: MessageFlags.Ephemeral,
    fetchReply: true,
  });

  session.sessionMsgId = msg.id;
  return true;
}

export async function handleCsTeamsSelect(interaction: StringSelectMenuInteraction) {
  const session = criarScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada. Use /criarscrim novamente.", flags: MessageFlags.Ephemeral });
    return;
  }
  session.maxTeams = parseInt(interaction.values[0]!, 10);
  await interaction.deferUpdate();
}

export async function handleCsModeSelect(interaction: StringSelectMenuInteraction) {
  const session = criarScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada. Use /criarscrim novamente.", flags: MessageFlags.Ephemeral });
    return;
  }
  session.mode = interaction.values[0]!;
  await interaction.deferUpdate();
}

export async function handleCsCtimeSelect(interaction: StringSelectMenuInteraction) {
  const session = criarScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada. Use /criarscrim novamente.", flags: MessageFlags.Ephemeral });
    return;
  }
  session.confirmMinutes = parseInt(interaction.values[0]!, 10);
  await interaction.deferUpdate();
}

export async function handleCsNext1(interaction: ButtonInteraction) {
  const session = criarScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada. Use /criarscrim novamente.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (!session.maxTeams || !session.mode || !session.confirmMinutes) {
    await interaction.reply({
      content: "❌ Por favor selecione todos os campos antes de continuar.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (session.mode === "mobile") {
    session.step = "aimassist";
    const aimOnBtn = new ButtonBuilder()
      .setCustomId("cs_aim_on")
      .setLabel("✅ Ativado")
      .setStyle(ButtonStyle.Success);
    const aimOffBtn = new ButtonBuilder()
      .setCustomId("cs_aim_off")
      .setLabel("🚫 Desativado")
      .setStyle(ButtonStyle.Danger);

    const embed = new EmbedBuilder()
      .setTitle("🎯 Assistência de Mira")
      .setDescription("Modo **Full Mobile** selecionado. Configure a assistência de mira:")
      .setColor(0x5865f2);

    await interaction.update({
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(aimOnBtn, aimOffBtn)],
    });
  } else {
    session.step = "roomconfig";
    await showRoomConfigStep(interaction, session);
  }
}

export async function handleCsAimAssist(interaction: ButtonInteraction, value: boolean) {
  const session = criarScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada.", flags: MessageFlags.Ephemeral });
    return;
  }
  session.aimAssist = value;
  session.step = "roomconfig";
  await showRoomConfigStep(interaction, session);
}

async function showRoomConfigStep(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  session: CriarScrimSession
) {
  const roomBtn = new ButtonBuilder()
    .setCustomId("cs_room_btn")
    .setLabel("✏️ Configurar Sala")
    .setStyle(ButtonStyle.Primary);

  const embed = new EmbedBuilder()
    .setTitle("⚙️ Configuração da Sala")
    .setDescription(
      session.roomConfig
        ? `✅ Configuração salva:\n\`\`\`${session.roomConfig}\`\`\`\nClique novamente para editar, ou prossiga.`
        : "Clique no botão abaixo para inserir a configuração da sala."
    )
    .setColor(0x5865f2);

  const nextBtn = new ButtonBuilder()
    .setCustomId("cs_room_next")
    .setLabel("Próximo ➡️")
    .setStyle(ButtonStyle.Success)
    .setDisabled(!session.roomConfig);

  const payload = {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(roomBtn, nextBtn),
    ],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (interaction as any).update(payload);
}

export async function handleCsRoomBtn(interaction: ButtonInteraction) {
  const session = criarScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada.", flags: MessageFlags.Ephemeral });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("modal_room")
    .setTitle("⚙️ Configuração da Sala");

  const input = new TextInputBuilder()
    .setCustomId("room_config_input")
    .setLabel("Configuração da Sala (ID, senha, etc)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(session.roomConfig ?? "")
    .setPlaceholder("Ex: ID: 123456 | Senha: abc123");

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

export async function handleRoomConfigModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== "modal_room") return false;

  const session = criarScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada.", flags: MessageFlags.Ephemeral });
    return true;
  }

  session.roomConfig = interaction.fields.getTextInputValue("room_config_input");
  session.step = "roomconfig";
  await showRoomConfigStep(interaction as unknown as ModalSubmitInteraction, session);
  return true;
}

export async function handleCsRoomNext(interaction: ButtonInteraction) {
  const session = criarScrimSessions.get(interaction.user.id);
  if (!session || !session.roomConfig) {
    await interaction.reply({ content: "❌ Configure a sala primeiro.", flags: MessageFlags.Ephemeral });
    return;
  }

  session.step = "rules";

  const guildConfig = getGuildConfig(session.guildId) ?? defaultGuildConfig();

  if (guildConfig.rules.length === 0) {
    await showCreateButton(interaction, session, guildConfig.orgName);
    return;
  }

  const rulesRow = buildConfirmRulesSelect(guildConfig.rules);

  const createBtn = new ButtonBuilder()
    .setCustomId("cs_create")
    .setLabel("🎮 Criar Scrim")
    .setStyle(ButtonStyle.Success);

  const embed = new EmbedBuilder()
    .setTitle("📜 Regras da Scrim")
    .setDescription("Selecione as regras que se aplicam a esta scrim:")
    .setColor(0x5865f2);

  await interaction.update({
    embeds: [embed],
    components: [
      rulesRow,
      new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn),
    ],
  });
}

async function showCreateButton(
  interaction: ButtonInteraction,
  session: CriarScrimSession,
  orgName: string
) {
  session.rules = [];
  const createBtn = new ButtonBuilder()
    .setCustomId("cs_create")
    .setLabel("🎮 Criar Scrim")
    .setStyle(ButtonStyle.Success);

  const embed = new EmbedBuilder()
    .setTitle("✅ Pronto!")
    .setDescription("Todas as configurações foram definidas. Clique abaixo para criar a scrim.")
    .setColor(0x00c853);

  await interaction.update({
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn)],
  });
}

export async function handleCsRulesSelect(interaction: StringSelectMenuInteraction) {
  const session = criarScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada.", flags: MessageFlags.Ephemeral });
    return;
  }

  const guildConfig = getGuildConfig(session.guildId) ?? defaultGuildConfig();
  const selected = interaction.values.map((v) => {
    const idx = parseInt(v.replace("rule_", ""), 10);
    return guildConfig.rules[idx] ?? "";
  }).filter(Boolean);

  session.rules = selected;
  await interaction.deferUpdate();
}

export async function handleCsCreate(interaction: ButtonInteraction) {
  const session = criarScrimSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: "❌ Sessão expirada. Use /criarscrim novamente.", flags: MessageFlags.Ephemeral });
    return;
  }

  if (!session.time || !session.maxTeams || !session.mode || !session.confirmMinutes) {
    await interaction.reply({ content: "❌ Configuração incompleta. Use /criarscrim novamente.", flags: MessageFlags.Ephemeral });
    return;
  }

  const guild = interaction.guild!;
  const guildConfig = getGuildConfig(session.guildId) ?? defaultGuildConfig();

  const parsed = parseTime(session.time)!;

  let createdRoleId: string | null = null;
  try {
    const role = await guild.roles.create({
      name: `Scrim ${session.time}`,
      color: 0x5865f2,
      reason: "Scrim criada automaticamente",
    });
    createdRoleId = role.id;
  } catch {
  }

  const scrim: ActiveScrim = {
    panelMessageId: "",
    panelChannelId: interaction.channelId,
    guildId: guild.id,
    time: session.time,
    timeHour: parsed.hour,
    timeMin: parsed.min,
    mode: session.mode,
    maxTeams: session.maxTeams,
    confirmMinutes: session.confirmMinutes,
    aimAssist: session.mode === "mobile" ? (session.aimAssist ?? false) : null,
    roomConfig: session.roomConfig ?? "",
    rules: session.rules ?? [],
    teams: [],
    createdRoleId,
    idSenhaChannelId: null,
    confirmationTimerId: null,
    idSenhaTimerId: null,
    started: false,
  };

  const embed = buildPanelEmbed(scrim, guildConfig.orgName);
  const components = buildPanelComponents(scrim);

  await interaction.update({ content: "✅ Scrim criada!", embeds: [], components: [] });

  const panelMsg = await (interaction.channel as import("discord.js").TextChannel).send({ embeds: [embed], components });
  scrim.panelMessageId = panelMsg.id;
  scrim.panelChannelId = panelMsg.channelId;

  activeScrims.set(guild.id, scrim);
  criarScrimSessions.delete(interaction.user.id);

  scheduleConfirmation(guild, scrim, guildConfig.orgName);
  scheduleIdSenha(guild, scrim, guildConfig);
}

function scheduleConfirmation(guild: Guild, scrim: ActiveScrim, orgName: string) {
  const now = new Date();
  const scrimDate = new Date();
  scrimDate.setHours(scrim.timeHour, scrim.timeMin, 0, 0);
  if (scrimDate <= now) scrimDate.setDate(scrimDate.getDate() + 1);

  const confirmMs = scrim.confirmMinutes * 60 * 1000;
  const confirmAt = scrimDate.getTime() - confirmMs;
  const delay = confirmAt - now.getTime();
  if (delay <= 0) return;

  scrim.confirmationTimerId = setTimeout(async () => {
    await sendConfirmationMessage(guild, scrim, orgName);
  }, delay);
}

export async function sendConfirmationMessage(guild: Guild, scrim: ActiveScrim, orgName: string) {
  try {
    const ch = guild.channels.cache.get(scrim.panelChannelId);
    if (!ch?.isTextBased()) return;

    const confirmBtn = new ButtonBuilder()
      .setCustomId("confirm_yes")
      .setLabel("✅ Confirmar presença")
      .setStyle(ButtonStyle.Success);

    const cancelBtn = new ButtonBuilder()
      .setCustomId("confirm_no")
      .setLabel("❌ Cancelar participação")
      .setStyle(ButtonStyle.Danger);

    const embed = new EmbedBuilder()
      .setTitle("⚠️ Confirmação Obrigatória")
      .setDescription(
        `A scrim das **${scrim.time}** começa em ${scrim.confirmMinutes < 60 ? scrim.confirmMinutes + " minutos" : "1 hora"}!\n\nTodos os capitães de time devem confirmar sua presença.`
      )
      .setColor(0xffcc00);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);
    const msg = await ch.send({ embeds: [embed], components: [row] });
    scheduleDelete(msg as unknown as import("discord.js").Message, 70 * 60 * 1000);
  } catch {
  }
}

function scheduleIdSenha(guild: Guild, scrim: ActiveScrim, guildConfig: ReturnType<typeof getGuildConfig> extends null ? never : NonNullable<ReturnType<typeof getGuildConfig>>) {
  const now = new Date();
  const scrimDate = new Date();
  scrimDate.setHours(scrim.timeHour, scrim.timeMin, 0, 0);
  if (scrimDate <= now) scrimDate.setDate(scrimDate.getDate() + 1);

  const idSenhaAt = scrimDate.getTime() - 10 * 60 * 1000;
  const delay = idSenhaAt - now.getTime();
  if (delay <= 0) return;

  scrim.idSenhaTimerId = setTimeout(async () => {
    await createIdSenhaChannel(guild, scrim, guildConfig);
  }, delay);
}

export async function createIdSenhaChannel(
  guild: Guild,
  scrim: ActiveScrim,
  guildConfig: { categoryId: string; scrimRoleId: string } | null
) {
  try {
    const permissionOverwrites: import("discord.js").OverwriteResolvable[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
    ];

    if (scrim.createdRoleId) {
      permissionOverwrites.push({
        id: scrim.createdRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }

    const parentId = guildConfig?.categoryId || undefined;

    const ch = await guild.channels.create({
      name: "id-e-senha",
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites,
      reason: `Canal ID e Senha para scrim ${scrim.time}`,
    });

    scrim.idSenhaChannelId = ch.id;

    await ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("🔐 ID e Senha da Sala")
          .setDescription(scrim.roomConfig || "A configuração da sala será enviada em breve.")
          .setColor(0x5865f2),
      ],
    });
  } catch {
  }
}
