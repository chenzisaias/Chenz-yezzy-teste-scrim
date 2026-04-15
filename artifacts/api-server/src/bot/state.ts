import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { GuildConfig, ActiveScrim, CriarScrimSession, ConfigScrimSession } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, "../../data/guild-configs.json");

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadConfigs(): Record<string, GuildConfig> {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveConfigs(configs: Record<string, GuildConfig>) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(configs, null, 2));
}

export const guildConfigs: Record<string, GuildConfig> = loadConfigs();

export function getGuildConfig(guildId: string): GuildConfig | null {
  return guildConfigs[guildId] ?? null;
}

export function setGuildConfig(guildId: string, config: GuildConfig) {
  guildConfigs[guildId] = config;
  saveConfigs(guildConfigs);
}

export function defaultGuildConfig(): GuildConfig {
  return {
    orgName: "PRIME RUSH",
    categoryId: "",
    captainRoleId: "",
    scrimRoleId: "",
    adminIds: [],
    roomConfig: "",
    rules: [],
  };
}

export const activeScrims = new Map<string, ActiveScrim>();

export const criarScrimSessions = new Map<string, CriarScrimSession>();

export const configScrimSessions = new Map<string, ConfigScrimSession>();
