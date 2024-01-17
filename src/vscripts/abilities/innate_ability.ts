import { registerAbility, BaseAbility } from "../lib/dota_ts_adapter";

export class InnateAbility extends BaseAbility {
  Spawn(): void {
    if (IsServer()) {
      this.SetLevel(1);
    }
  }
}
