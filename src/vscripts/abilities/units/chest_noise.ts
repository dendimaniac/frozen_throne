import { registerAbility, BaseAbility } from "../../lib/dota_ts_adapter";
import { modifier_chest_noise } from "../../modifiers/modifier_chest_noise";
import { InnateAbility } from "../innate_ability";

@registerAbility()
export class chest_noise extends InnateAbility {
  GetIntrinsicModifierName(): string {
    return modifier_chest_noise.name;
  }
}
