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

  IdleThink(context: this) {
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

    if (units.length > 0) {
      context.spawnPos = context.unit.GetAbsOrigin();
      context.aggroTarget = units[0];
      context.unit.MoveToTargetToAttack(context.aggroTarget);
      context.state = AI_STATE_AGGRESSIVE;
    }
  }

  AggressiveThink(context: this) {
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

  ReturningThink(context: this) {
    const distanceToSpawnPos = (
      (context.spawnPos - context.unit.GetAbsOrigin()) as Vector
    ).Length();
    if (distanceToSpawnPos < 10) {
      context.state = AI_STATE_IDLE;
      return;
    }

    context.unit.MoveToPosition(context.spawnPos);
  }

  // Run when modifier instance is created
  OnCreated(params: { aggroRange: number; leashRange: number }) {
    if (IsServer()) {
      this.state = AI_STATE_IDLE;
      this.unit = this.GetParent();
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

  // Called when intervalThink is triggered
  OnIntervalThink() {
    this.stateActions[this.state](this);
  }
}
