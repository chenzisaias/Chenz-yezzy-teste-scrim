import {
  Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Guild,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";
import { activeScrims } from "./state.js";
import type { ActiveScrim, Team } from "./types.js";

export const AUTO_DELETE_MS = 4 * 60 * 1000;

export function scheduleDelete(msg: Message, ms = AUTO_DELETE_MS) {
  setTimeout(async () => {
    try {
      await msg.delete();
    } catch {
    }
  }, ms);
}

export function modeLabel(mode: string): string {
  const map: Record<string, string> = {
    mobile: "📱 Full Mobile",
    misto: "🔀 Misto",
    emulador: "💻 Emulador",
  };
  return map[mode] ?? mode;
}

export function confirmLabel(minutes: number): string {
  if (minutes === 60) return "1h antes";
  return `${minutes} min antes`;
}

export function buildPanelEmbed(scrim: ActiveScrim, orgName: string): EmbedBuilder {
  const filledSlots = scrim.teams.length;
  const totalSlots = scrim.maxTeams;
  const isFull = filledSlots >= totalSlots;
  const title = isFull
    ? `${orgName} — SCRIM FECHADA 🔒`
    : `${orgName} — SCRIM ABERTA 🎮`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(isFull ? 0xff4444 : 0x00c853)
    .addFields(
      { name: "🕒 Horário", value: scrim.time, inline: true },
      { name: "👥 Times", value: `${filledSlots}/${totalSlots}`, inline: true },
      { name: "🎮 Modo", value: modeLabel(scrim.mode), inline: true },
    );

  if (scrim.aimAssist !== null && scrim.mode === "mobile") {
    embed.addFields({
      name: "🎯 Assistência de Mira",
      value: scrim.aimAssist ? "✅ Ativado" : "🚫 Desativado",
      inline: true,
    });
  }

  if (scrim.roomConfig) {
    embed.addFields({ name: "⚙️ Config da Sala", value: scrim.roomConfig, inline: false });
  }

  if (scrim.rules.length > 0) {
    embed.addFields({
      name: "📜 Regras",
      value: scrim.rules.map((r) => `🚫 ${r}`).join("\n"),
      inline: false,
    });
  }

  const slotsLines: string[] = [];
  for (let i = 0; i < totalSlots; i++) {
    const team = scrim.teams.find((t) => t.slotIndex === i);
    if (team) {
      const confirmed = scrim.started ? (team.confirmed ? " ✅" : " ⏳") : "";
      slotsLines.push(`**SLOT ${i + 1}** — ${team.name}${confirmed}`);
    } else {
      slotsLines.push(`**SLOT ${i + 1}** — Livre`);
    }
  }

  embed.addFields({ name: "📋 Slots", value: slotsLines.join("\n"), inline: false });

  return embed;
}

export function buildPanelComponents(scrim: ActiveScrim) {
  const isFull = scrim.teams.length >= scrim.maxTeams;
  const enterBtn = new ButtonBuilder()
    .setCustomId("panel_enter")
    .setLabel("Entrar com Time")
    .setEmoji("🔘")
    .setStyle(ButtonStyle.Success)
    .setDisabled(isFull || scrim.started);

  const leaveBtn = new ButtonBuilder()
    .setCustomId("panel_leave")
    .setLabel("Sair da Scrim")
    .setEmoji("🚪")
    .setStyle(ButtonStyle.Danger);

  const cfgBtn = new ButtonBuilder()
    .setCustomId("panel_callcfg")
    .setLabel("Config Call")
    .setEmoji("⚙️")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(enterBtn, leaveBtn, cfgBtn);
  return [row];
}

export async function refreshPanel(guild: Guild, scrim: ActiveScrim, orgName: string) {
  try {
    const ch = guild.channels.cache.get(scrim.panelChannelId) as TextChannel | undefined;
    if (!ch) return;
    const msg = await ch.messages.fetch(scrim.panelMessageId);
    if (!msg) return;
    await msg.edit({
      embeds: [buildPanelEmbed(scrim, orgName)],
      components: buildPanelComponents(scrim),
    });
  } catch {
  }
}

export function parseTime(timeStr: string): { hour: number; min: number } | null {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1]!, 10);
  const min = parseInt(match[2]!, 10);
  if (hour < 0 || hour > 23 || min < 0 || min > 59) return null;
  return { hour, min };
}

export function getTeamBycaptain(scrim: ActiveScrim, userId: string): Team | undefined {
  return scrim.teams.find((t) => t.captainId === userId);
}

export function isAdmin(guildConfig: { adminIds: string[] } | null, userId: string, ownerId: string): boolean {
  if (userId === ownerId) return true;
  if (!guildConfig) return false;
  return guildConfig.adminIds.includes(userId);
}

export function buildConfirmRulesSelect(rules: string[]): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = rules.map((r, i) => ({
    label: r.length > 100 ? r.substring(0, 97) + "..." : r,
    value: `rule_${i}`,
    emoji: "🚫",
    default: false,
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId("cs_rules")
    .setPlaceholder("Selecione as regras para esta scrim")
    .setMinValues(0)
    .setMaxValues(options.length)
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}
