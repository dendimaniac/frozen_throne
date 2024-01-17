import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

@registerModifier()
export class modifier_zombie_damage_block extends BaseModifier {
  unit!: CDOTA_BaseNPC;
  ability!: CDOTABaseAbility;
  blockChance: number = 0;
  blockPercentage: number = 0;

  OnCreated(): void {
    this.ability = this.GetAbility()!;
    this.unit = this.GetParent();
    this.blockChance = this.ability.GetSpecialValueFor("block_chance");
    this.blockPercentage = this.ability.GetSpecialValueFor("block_percentage");
  }

  DeclareFunctions(): ModifierFunction[] {
    return [ModifierFunction.INCOMING_DAMAGE_PERCENTAGE];
  }

  GetModifierIncomingDamage_Percentage(event: ModifierAttackEvent): number {
    if (IsServer()) {
      if (event.target === this.unit) {
        var canBlock = RandomFloat(0, 100) <= this.blockChance;
        if (canBlock) {
          return -this.blockPercentage;
        }
      }
    }
    return 0;
  }

  IsHidden(): boolean {
    return true;
  }
}
