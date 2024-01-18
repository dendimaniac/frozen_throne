import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

const soundDelay = 2;

@registerModifier()
export class modifier_gate_under_attack extends BaseModifier {
  unit!: CDOTA_BaseNPC;
  underAttackSound = "announcer_ann_custom_generic_alert_01";
  soundDuration!: number;
  soundPlayingTimer: string | undefined;
  gateNum!: number;

  OnCreated(): void {
    if (IsServer()) {
      this.unit = this.GetParent();
      this.gateNum = this.unit.Attribute_GetIntValue("index", 0);
      print(`Gate num: ${this.gateNum}`);
      this.soundDuration =
        this.unit.GetSoundDuration(this.underAttackSound, "") + soundDelay;
    }
  }

  DeclareFunctions(): ModifierFunction[] {
    return [ModifierFunction.INCOMING_DAMAGE_PERCENTAGE];
  }

  GetModifierIncomingDamage_Percentage(event: ModifierAttackEvent): number {
    if (IsServer()) {
      if (this.soundPlayingTimer === undefined) {
        EmitAnnouncerSoundForTeam(this.underAttackSound, DotaTeam.GOODGUYS);
        this.soundPlayingTimer = Timers.CreateTimer(this.soundDuration, () => {
          Timers.RemoveTimer(this.soundPlayingTimer!);
          this.soundPlayingTimer = undefined;
        });
      }
    }

    return 100;
  }

  IsHidden(): boolean {
    return true;
  }

  OnRemoved(death: boolean): void {
    if (death) {
      const gateBlockEntity = Entities.FindByName(
        undefined,
        `gate_obstruction_${this.gateNum}`
      )! as CDOTA_SimpleObstruction;
      gateBlockEntity.Destroy();
    }
  }
}
