import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

@registerModifier()
export class modifier_permanent_phased extends BaseModifier {
  CheckState(): Partial<Record<ModifierState, boolean>> {
    return {
      [ModifierState.FLYING_FOR_PATHING_PURPOSES_ONLY]: true,
      [ModifierState.NO_UNIT_COLLISION]: true,
    };
  }

  RemoveOnDeath(): boolean {
    return false;
  }

  IsHidden(): boolean {
    return true;
  }
}
