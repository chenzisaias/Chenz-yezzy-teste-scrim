import {
  Interaction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  RoleSelectMenuInteraction,
  UserSelectMenuInteraction,
  ComponentType,
} from "discord.js";
import { handleCriarScrim, handleCriarScrimModal, handleCsTeamsSelect, handleCsModeSelect, handleCsCtimeSelect, handleCsNext1, handleCsAimAssist, handleCsRoomBtn, handleRoomConfigModal, handleCsRoomNext, handleCsRulesSelect, handleCsCreate } from "./flows/criarscrim.js";
import { handlePanelEnter, handlePanelEnterModal, handlePanelLeave, handlePanelCallCfg, handleConfirmYes, handleConfirmNo } from "./flows/painel.js";
import { handleCallSelect, handleCallRemovePlayer, handleCallAllowPlayer, handleLimitPlayersModal } from "./flows/callconfig.js";
import { handleCfgOrgNameBtn, handleCfgOrgNameModal, handleCfgCatBtn, handleCfgCatSelect, handleCfgCapRoleBtn, handleCfgCapRoleSelect, handleCfgScrimRoleBtn, handleCfgScrimRoleSelect, handleCfgAdminBtn, handleCfgAdminSelect, handleCfgSalaBtn, handleCfgSalaModal, handleCfgRulesBtn, handleCfgRulesModal } from "./flows/configscrim.js";

export async function handleInteraction(interaction: Interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
      await handleStringSelect(interaction);
    } else if (interaction.isRoleSelectMenu()) {
      await handleRoleSelect(interaction);
    } else if (interaction.isUserSelectMenu()) {
      await handleUserSelect(interaction);
    }
  } catch (err) {
    console.error("Interaction error:", err);
    try {
      const errMsg = { content: "❌ Ocorreu um erro. Tente novamente.", flags: 64 };
      if (interaction.isRepliable()) {
        if (interaction.replied || interaction.deferred) {
          await (interaction as ButtonInteraction).followUp(errMsg);
        } else {
          await (interaction as ButtonInteraction).reply(errMsg);
        }
      }
    } catch {}
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction) {
  if (interaction.commandName === "criarscrim") {
    await handleCriarScrim(interaction);
  }
}

async function handleModal(interaction: ModalSubmitInteraction) {
  if (await handleCriarScrimModal(interaction)) return;
  if (await handleRoomConfigModal(interaction)) return;
  if (await handlePanelEnterModal(interaction)) return;
  if (await handleLimitPlayersModal(interaction)) return;
  if (await handleCfgOrgNameModal(interaction)) return;
  if (await handleCfgSalaModal(interaction)) return;
  if (await handleCfgRulesModal(interaction)) return;
}

async function handleButton(interaction: ButtonInteraction) {
  const id = interaction.customId;

  if (id === "cs_next1") return handleCsNext1(interaction);
  if (id === "cs_aim_on") return handleCsAimAssist(interaction, true);
  if (id === "cs_aim_off") return handleCsAimAssist(interaction, false);
  if (id === "cs_room_btn") return handleCsRoomBtn(interaction);
  if (id === "cs_room_next") return handleCsRoomNext(interaction);
  if (id === "cs_create") return handleCsCreate(interaction);

  if (id === "panel_enter") return handlePanelEnter(interaction);
  if (id === "panel_leave") return handlePanelLeave(interaction);
  if (id === "panel_callcfg") return handlePanelCallCfg(interaction);

  if (id === "confirm_yes") return handleConfirmYes(interaction);
  if (id === "confirm_no") return handleConfirmNo(interaction);

  if (id === "cfg_orgname_btn") return handleCfgOrgNameBtn(interaction);
  if (id === "cfg_cat_btn") return handleCfgCatBtn(interaction);
  if (id === "cfg_caprole_btn") return handleCfgCapRoleBtn(interaction);
  if (id === "cfg_scrimrole_btn") return handleCfgScrimRoleBtn(interaction);
  if (id === "cfg_admin_btn") return handleCfgAdminBtn(interaction);
  if (id === "cfg_sala_btn") return handleCfgSalaBtn(interaction);
  if (id === "cfg_rules_btn") return handleCfgRulesBtn(interaction);
}

async function handleStringSelect(interaction: StringSelectMenuInteraction) {
  const id = interaction.customId;

  if (id === "cs_teams") return handleCsTeamsSelect(interaction);
  if (id === "cs_mode") return handleCsModeSelect(interaction);
  if (id === "cs_ctime") return handleCsCtimeSelect(interaction);
  if (id === "cs_rules") return handleCsRulesSelect(interaction);

  if (id === "call_select") return handleCallSelect(interaction);
  if (id === "call_rp_sel") return handleCallRemovePlayer(interaction);

  if (id === "cfg_cat_sel") return handleCfgCatSelect(interaction);
}

async function handleRoleSelect(interaction: RoleSelectMenuInteraction) {
  const id = interaction.customId;
  if (id === "cfg_caprole_sel") return handleCfgCapRoleSelect(interaction);
  if (id === "cfg_scrimrole_sel") return handleCfgScrimRoleSelect(interaction);
}

async function handleUserSelect(interaction: UserSelectMenuInteraction) {
  const id = interaction.customId;
  if (id === "call_pp_sel") return handleCallAllowPlayer(interaction);
  if (id === "cfg_admin_sel") return handleCfgAdminSelect(interaction);
}
