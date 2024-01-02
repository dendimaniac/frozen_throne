import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

@registerModifier()
export class modifier_no_health_regen extends BaseModifier {
  healthRegen!: number;

  OnCreated(): void {
    if (IsServer()) {
      const unit = this.GetParent() as CDOTA_BaseNPC_Hero;
      this.healthRegen = unit.GetBaseHealthRegen();
      this.SetHasCustomTransmitterData(true);
      this.StartIntervalThink(0.1);
    }
  }

  OnIntervalThink(): void {
    this.OnRefresh({});
  }

  // Override speed given by Modifier_Speed
  DeclareFunctions(): ModifierFunction[] {
    return [ModifierFunction.HEALTH_REGEN_CONSTANT];
  }

  GetModifierConstantHealthRegen(): number {
    return -this.healthRegen;
  }

  IsHidden(): boolean {
    return true;
  }

  OnRefresh(_: object): void {
    if (IsServer()) {
      this.OnCreated();
      this.SendBuffRefreshToClients();
    }
  }

  AddCustomTransmitterData() {
    return { healthRegen: this.healthRegen };
  }

  HandleCustomTransmitterData(data: { healthRegen: number }) {
    this.healthRegen = data.healthRegen;
  }
}
