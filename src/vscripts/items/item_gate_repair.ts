import { BaseAbility, BaseItem, registerAbility } from "../lib/dota_ts_adapter";
import { modifier_item_gate_repair } from "../modifiers/modifier_item_gate_repair";
import { clampPosition } from "../utils";

@registerAbility()
export class item_gate_repair extends BaseItem {
  OnSpellStart() {
    const caster = this.GetCaster();
    const target = this.GetCursorTarget();
    if (target === undefined) return;

    target.AddNewModifier(caster, this, modifier_item_gate_repair.name, {
      duration: this.GetSpecialValueFor("duration"),
      thinkInterval: this.GetSpecialValueFor("think_interval"),
      healPerTick: this.GetSpecialValueFor("heal_per_tick"),
    });
    EmitSoundOn("DOTA_Item.HealingSalve.Activate", target);
    this.SpendCharge();
  }
}
