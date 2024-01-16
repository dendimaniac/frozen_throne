import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

@registerModifier()
export class modifier_no_health_regen extends BaseModifier {
  unit!: CDOTA_BaseNPC;

  OnCreated(): void {
    this.unit = this.GetParent();
  }

  DeclareFunctions(): ModifierFunction[] {
    return [ModifierFunction.HEALTH_REGEN_CONSTANT];
  }

  GetModifierConstantHealthRegen(): number {
    if (this.unit.IsHero()) {
      const hero = this.unit as CDOTA_BaseNPC_Hero;
      return -(hero.GetStrength() * 0.1);
    }

    return 0;
  }

  IsHidden(): boolean {
    return true;
  }
}
