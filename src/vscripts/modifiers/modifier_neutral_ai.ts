import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

const AI_STATE_IDLE = 0;
const AI_STATE_AGGRESSIVE = 1;
const AI_STATE_RETURNING = 2;

const AI_THINK_INTERVAL = 0.5;

type State =
  | typeof AI_STATE_IDLE
  | typeof AI_STATE_AGGRESSIVE
  | typeof AI_STATE_RETURNING;

@registerModifier()
export class modifier_neutral_ai extends BaseModifier {
  state!: State;
  aggroRange!: number;
  leashRange!: number;
  unit!: CDOTA_BaseNPC;
  spawnPos!: Vector;
  aggroTarget!: CDOTA_BaseNPC;
  stateActions!: { [key: number]: (context: any) => void };

  IdleThink(context: this): void {
    if (!context.unit) return;

    const units = FindUnitsInRadius(
      context.unit.GetTeam(),
      context.unit.GetAbsOrigin(),
      undefined,
      context.aggroRange,
      UnitTargetTeam.ENEMY,
      UnitTargetType.ALL,
      UnitTargetFlags.NONE,
      FindOrder.ANY,
      false
    );

    if (units.length === 0) return;

    context.aggroTarget = units[0];
    context.unit.MoveToTargetToAttack(context.aggroTarget);
    context.state = AI_STATE_AGGRESSIVE;
  }

  AggressiveThink(context: this): void {
    const distanceToSpawnPos = (
      (context.spawnPos - context.unit.GetAbsOrigin()) as Vector
    ).Length();
    if (distanceToSpawnPos > context.leashRange) {
      context.unit.MoveToPosition(context.spawnPos);
      context.state = AI_STATE_RETURNING;
      return;
    }

    if (!context.aggroTarget.IsAlive()) {
      context.unit.MoveToPosition(context.spawnPos);
      context.state = AI_STATE_RETURNING;
      return;
    }

    context.unit.MoveToTargetToAttack(context.aggroTarget);
  }

  ReturningThink(context: this): void {
    const distanceToSpawnPos = (
      (context.spawnPos - context.unit.GetAbsOrigin()) as Vector
    ).Length();
    if (distanceToSpawnPos < 10) {
      context.state = AI_STATE_IDLE;
      return;
    }

    context.unit.MoveToPosition(context.spawnPos);
  }

  OnCreated(params: { aggroRange: number; leashRange: number }): void {
    if (IsServer()) {
      this.state = AI_STATE_IDLE;
      this.unit = this.GetParent();
      this.spawnPos = this.unit.GetAbsOrigin();
      this.aggroRange = params.aggroRange;
      this.leashRange = params.leashRange;
      this.stateActions = {
        [AI_STATE_IDLE]: this.IdleThink,
        [AI_STATE_AGGRESSIVE]: this.AggressiveThink,
        [AI_STATE_RETURNING]: this.ReturningThink,
      };
      this.StartIntervalThink(AI_THINK_INTERVAL);
    }
  }

  IsHidden(): boolean {
    return true;
  }

  OnIntervalThink(): void {
    this.stateActions[this.state](this);
  }
}
