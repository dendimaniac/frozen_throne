import { registerAbility, BaseAbility } from "../../lib/dota_ts_adapter";
import { modifier_zombie_damage_block } from "../../modifiers/modifier_zombie_damage_block";
import { InnateAbility } from "../innate_ability";

@registerAbility()
export class ability_zombie_damage_block extends InnateAbility {
  GetIntrinsicModifierName(): string {
    return modifier_zombie_damage_block.name;
  }
}
