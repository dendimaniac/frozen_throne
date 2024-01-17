import { BaseAbility, BaseItem, registerAbility } from "../lib/dota_ts_adapter";
import { clampPosition } from "../utils";

@registerAbility()
export class item_blink_custom extends BaseItem {
  OnSpellStart() {
    const caster = this.GetCaster();
    ParticleManager.CreateParticle(
      "particles/items_fx/blink_dagger_start.vpcf",
      ParticleAttachment.ABSORIGIN,
      caster
    );
    caster.EmitSound("DOTA_Item.BlinkDagger.Activate");
    ProjectileManager.ProjectileDodge(caster);
    const cursor = this.GetCursorPosition();
    const castRange = this.GetSpecialValueFor("cast_range");
    print(`Cast: ${castRange}`);
    const origin = caster.GetAbsOrigin();
    const point = clampPosition(origin, cursor, {
      maxRange: castRange,
      minRange: 0,
    });
    FindClearSpaceForUnit(caster, point, true);
    ParticleManager.CreateParticle(
      "particles/items_fx/blink_dagger_end.vpcf",
      ParticleAttachment.ABSORIGIN,
      caster
    );
    this.SpendCharge();
  }
}
