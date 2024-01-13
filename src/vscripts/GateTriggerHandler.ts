import { GameMode } from "./GameMode";
import { registerEntityFunction } from "./lib/dota_ts_adapter";
import { reloadable } from "./lib/tstl-utils";

export interface TriggerEvent {
  outputid: number;
  activator: CDOTA_BaseNPC;
  caller: CBaseEntity;
}

registerEntityFunction("OnStartTouch", (trigger: TriggerEvent) => {
  const triggerName = trigger.caller.GetName();
  const gateNum = parseInt(triggerName.split("_").pop()!);
  const gateBlockEntity = Entities.FindByName(
    undefined,
    `gate_obstruction_${gateNum}`
  )! as CDOTA_SimpleObstruction;
  gateBlockEntity.SetEnabled(false, false);
  print(`TEST: Gate disabled!`);
});

registerEntityFunction("OnEndTouchAll", (trigger: TriggerEvent) => {
  const triggerName = trigger.caller.GetName();
  const gateNum = parseInt(triggerName.split("_").pop()!);
  const gateBlockEntity = Entities.FindByName(
    undefined,
    `gate_obstruction_${gateNum}`
  )! as CDOTA_SimpleObstruction;
  gateBlockEntity.SetEnabled(true, false);
  print(`TEST: Gate enabled!`);
});
