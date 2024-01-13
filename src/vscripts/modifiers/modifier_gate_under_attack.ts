import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

const soundDelay = 2;

@registerModifier()
export class modifier_gate_under_attack extends BaseModifier {
  unit!: CDOTA_BaseNPC;
  underAttackSound = "announcer_ann_custom_generic_alert_01";
  soundDuration!: number;
  soundPlayingTimer: string | undefined;

  OnCreated(): void {
    if (IsServer()) {
      this.unit = this.GetParent();
      this.soundDuration =
        this.unit.GetSoundDuration(this.underAttackSound, "") + soundDelay;
    }
  }

  DeclareFunctions(): ModifierFunction[] {
    return [ModifierFunction.ON_ATTACKED];
  }

  CheckState(): Partial<Record<ModifierState, boolean>> {
    return {
      [ModifierState.FLYING_FOR_PATHING_PURPOSES_ONLY]: true,
      [ModifierState.NO_UNIT_COLLISION]: true,
    };
  }

  OnAttacked(_: ModifierAttackEvent): void {
    if (IsServer()) {
      if (this.soundPlayingTimer === undefined) {
        EmitAnnouncerSoundForTeam(this.underAttackSound, DotaTeam.GOODGUYS);
        this.soundPlayingTimer = Timers.CreateTimer(this.soundDuration, () => {
          Timers.RemoveTimer(this.soundPlayingTimer!);
          this.soundPlayingTimer = undefined;
        });
      }
    }
  }

  IsHidden(): boolean {
    return true;
  }
}
