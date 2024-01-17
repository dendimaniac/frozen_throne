import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

@registerModifier()
export class modifier_item_gate_repair extends BaseModifier {
  healPerTick!: number;
  unit!: CDOTA_BaseNPC;
  ability!: CDOTABaseAbility;

  OnCreated(params: { thinkInterval: number; healPerTick: number }) {
    if (IsServer()) {
      this.unit = this.GetParent();
      this.ability = this.GetAbility()!;
      this.healPerTick = params.healPerTick;
      this.StartIntervalThink(params.thinkInterval);
    }
  }

  OnIntervalThink() {
    this.unit.Heal(this.healPerTick, this.ability);
  }

  GetEffectAttachType() {
    return ParticleAttachment.ABSORIGIN;
  }

  GetStatusEffectName() {
    return "particles/items_fx/healing_flask.vpcf";
  }
}
