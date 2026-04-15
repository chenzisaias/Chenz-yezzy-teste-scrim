export interface GuildConfig {
  orgName: string;
  categoryId: string;
  captainRoleId: string;
  scrimRoleId: string;
  adminIds: string[];
  roomConfig: string;
  rules: string[];
}

export interface Team {
  name: string;
  captainId: string;
  slotIndex: number;
  voiceChannelId: string;
  confirmed: boolean;
  callOpen: boolean;
  maxMembers: number | null;
  allowedUserIds: string[];
}

export interface ActiveScrim {
  panelMessageId: string;
  panelChannelId: string;
  guildId: string;
  time: string;
  timeHour: number;
  timeMin: number;
  mode: string;
  maxTeams: number;
  confirmMinutes: number;
  aimAssist: boolean | null;
  roomConfig: string;
  rules: string[];
  teams: Team[];
  createdRoleId: string | null;
  idSenhaChannelId: string | null;
  confirmationTimerId: ReturnType<typeof setTimeout> | null;
  idSenhaTimerId: ReturnType<typeof setTimeout> | null;
  started: boolean;
}

export interface CriarScrimSession {
  guildId: string;
  channelId: string;
  sessionMsgId?: string;
  time?: string;
  maxTeams?: number;
  mode?: string;
  confirmMinutes?: number;
  aimAssist?: boolean | null;
  roomConfig?: string;
  rules?: string[];
  step: "selects" | "aimassist" | "roomconfig" | "rules" | "done";
}

export interface ConfigScrimSession {
  guildId: string;
  channelId: string;
  sessionMsgId?: string;
}
