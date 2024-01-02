import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";

const AI_STATE_PATROLLING = 0;
const AI_STATE_PATROLL_WAIT = 1;
const AI_STATE_AGGRESSIVE = 2;
const AI_STATE_RETURNING = 3;

const AI_THINK_INTERVAL = 0.5;

const PATROL_WAIT_INTERVAL = 1;

type State =
  | typeof AI_STATE_PATROLLING
  | typeof AI_STATE_PATROLL_WAIT
  | typeof AI_STATE_AGGRESSIVE
  | typeof AI_STATE_RETURNING;

@registerModifier()
export class modifier_neutral_ai extends BaseModifier {
  state!: State;
  aggroRange!: number;
  leashRange!: number;
  unit!: CDOTA_BaseNPC;
  aggroTarget!: CDOTA_BaseNPC;
  stateActions!: { [key: number]: (context: any) => void };
  targetPatrol!: Vector;
  returnPoint!: Vector;
  returnState!: State;
  patrolWaitTimer: string | undefined;
  firstPatrol!: Vector;
  secondPatrol!: Vector;

  PatrolThink(context: this): void {
    const EnemyFound = context.CheckIfEnemyFound(context);
    if (EnemyFound) return;

    const currentPosition = context.unit.GetAbsOrigin();
    const distanceToPatrol = context.GetDistanceBetweenTwoPositions(
      currentPosition,
      context.targetPatrol
    );
    // print(`TEST: Distance to patrol: ${distanceToPatrol}`);
    if (distanceToPatrol < 0.05) {
      context.state = AI_STATE_PATROLL_WAIT;
      return;
    }

    context.unit.MoveToPosition(context.targetPatrol);
  }

  PatrolWaitThink(context: this): void {
    if (context.CheckIfEnemyFound(context)) {
      if (context.patrolWaitTimer) Timers.RemoveTimer(context.patrolWaitTimer);
      context.patrolWaitTimer = undefined;
      return;
    }

    if (!context.patrolWaitTimer) {
      context.patrolWaitTimer = Timers.CreateTimer(PATROL_WAIT_INTERVAL, () => {
        Timers.RemoveTimer(context.patrolWaitTimer!);
        context.patrolWaitTimer = undefined;
        context.targetPatrol =
          context.targetPatrol === context.firstPatrol
            ? context.secondPatrol
            : context.firstPatrol;
        context.state = AI_STATE_PATROLLING;
        return;
      });
    }
  }

  AggressiveThink(context: this): void {
    const distanceToReturnPoint = context.GetDistanceBetweenTwoPositions(
      context.returnPoint,
      context.unit.GetAbsOrigin()
    );
    if (distanceToReturnPoint > context.leashRange) {
      context.unit.MoveToPosition(context.returnPoint);
      context.state = AI_STATE_RETURNING;
      return;
    }

    if (!context.aggroTarget.IsAlive()) {
      context.unit.MoveToPosition(context.returnPoint);
      context.state = AI_STATE_RETURNING;
      return;
    }

    context.unit.MoveToTargetToAttack(context.aggroTarget);
  }

  ReturningThink(context: this): void {
    const distanceToSpawnPos = context.GetDistanceBetweenTwoPositions(
      context.returnPoint,
      context.unit.GetAbsOrigin()
    );
    if (distanceToSpawnPos < 0.05) {
      context.state = context.returnState;
      return;
    }

    context.unit.MoveToPosition(context.returnPoint);
  }

  OnCreated(params: { aggroRange: number; leashRange: number }): void {
    if (IsServer()) {
      this.state = AI_STATE_PATROLLING;
      this.unit = this.GetParent();
      const spawnPos = this.unit.GetAbsOrigin();
      this.firstPatrol = spawnPos;
      this.aggroRange = params.aggroRange;
      this.leashRange = params.leashRange;
      this.stateActions = {
        [AI_STATE_PATROLLING]: this.PatrolThink,
        [AI_STATE_PATROLL_WAIT]: this.PatrolWaitThink,
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
    // print(
    //   `MAINTEST: Current position: ${this.unit.GetAbsOrigin()}, target: ${
    //     this.targetPatrol
    //   }`
    // );
    this.stateActions[this.state](this);
  }

  GetDistanceBetweenTwoPositions(
    firstPosition: Vector,
    secondPosition: Vector
  ) {
    return ((firstPosition - secondPosition) as Vector).Length();
  }

  CheckIfEnemyFound(context: this): boolean {
    const units = FindUnitsInRadius(
      context.unit.GetTeam(),
      context.unit.GetAbsOrigin(),
      undefined,
      context.aggroRange,
      UnitTargetTeam.ENEMY,
      UnitTargetType.ALL,
      UnitTargetFlags.NONE,
      FindOrder.CLOSEST,
      false
    );

    if (units.length > 0) {
      context.aggroTarget = units[0];
      context.returnPoint = context.unit.GetAbsOrigin();
      context.returnState = context.state;
      context.state = AI_STATE_AGGRESSIVE;
      return true;
    }

    return false;
  }
}
