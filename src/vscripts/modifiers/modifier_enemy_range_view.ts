import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

@registerModifier()
export class modifier_enemy_range_view extends BaseModifier {
  unit!: CDOTA_BaseNPC;
  particleId: ParticleID | undefined;
  viewRangeCast = "particles/range_finder_aoe.vpcf";
  radius!: number;

  OnCreated(): void {
    if (IsClient()) {
      this.unit = this.GetParent();
      this.StartIntervalThink(0);
      this.radius = this.unit.GetCurrentVisionRange();

      this.particleId = ParticleManager.CreateParticle(
        this.viewRangeCast,
        ParticleAttachment.ABSORIGIN_FOLLOW,
        this.unit
      );
      this.ToggleParticle(IsDotaAltPressed() ? 1 : 0);
      ParticleManager.SetParticleControlEnt(
        this.particleId,
        2,
        this.unit,
        ParticleAttachment.ABSORIGIN_FOLLOW,
        "attach_hitloc",
        Vector(0, 0, 0),
        true
      );
      ParticleManager.SetParticleControl(
        this.particleId,
        3,
        Vector(this.radius, 0, 0)
      );
    }
  }

  OnIntervalThink(): void {
    if (IsClient()) {
      if (IsDotaAltPressed()) {
        this.ToggleParticle(1);
      } else {
        this.ToggleParticle(0);
      }
    }
  }

  IsHidden(): boolean {
    return true;
  }

  ToggleParticle(alphaValue: number): void {
    ParticleManager.SetParticleControl(
      this.particleId!,
      4,
      Vector(alphaValue, 0, 0)
    );
  }

  OnRemoved(death: boolean): void {
    if (IsClient()) {
      ParticleManager.DestroyParticle(this.particleId!, true);
      ParticleManager.ReleaseParticleIndex(this.particleId!);
      this.particleId = undefined;
    }
  }
}
