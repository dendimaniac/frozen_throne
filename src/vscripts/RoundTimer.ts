import { reloadable } from "./lib/tstl-utils";

const dayTime = 0.3;
const nightTime = 0.8;
const startDelay = 5;

export enum TimeOfDay {
  Day,
  Night,
}

@reloadable
export class RoundTimer {
  maxRoundTimer: number = 0;
  currentRoundTimer: number = 0;
  createdTimer: string = "";
  gameMode: CDOTABaseGameMode;
  roundPast: number = 0;
  nightPast: number = 0;
  onCycleUpdatedHandler: Array<
    (timeOfDay: TimeOfDay, roundPast: number, nightPast: number) => void
  > = [];
  onRoundTimerUpdatedHandler: Array<(roundTimer: number) => void> = [];

  constructor(maxRoundTimer: number) {
    this.maxRoundTimer = startDelay;
    this.updateRoundTimer(startDelay);
    this.startNewRound(false, maxRoundTimer);
    this.gameMode = GameRules.GetGameModeEntity();
    GameRules.SetTimeOfDay(dayTime);
  }

  public addOnCycleUpdatedHandler(
    method: (timeOfDay: TimeOfDay, roundPast: number, nightPast: number) => void
  ) {
    this.onCycleUpdatedHandler.push(method);
  }

  public addOnRoundTimerUpdatedHandler(method: (roundTimer: number) => void) {
    this.onRoundTimerUpdatedHandler.push(method);
  }

  private startNewRound(
    switchDayNight: boolean = true,
    newMaxRoundTimer: number = 0,
    startDelay: number = 0
  ) {
    if (switchDayNight) {
      const wasDayTime = GameRules.IsDaytime();
      if (!wasDayTime) this.nightPast++;
      GameRules.SetTimeOfDay(wasDayTime ? nightTime : dayTime);
      this.roundPast++;
      this.alertCycleUpdated(!wasDayTime);
    }
    this.createdTimer = Timers.CreateTimer(
      startDelay,
      () => {
        this.updateRoundTimer(this.currentRoundTimer - 1);
        if (this.currentRoundTimer === 0) {
          if (newMaxRoundTimer > 0) this.maxRoundTimer = newMaxRoundTimer;
          this.clearRoundTimer();
          this.startNewRound(true, 0, 1);
          return;
        }
        return 1;
      },
      this
    );
  }

  public ForceEndRound() {
    this.clearRoundTimer();
    this.updateRoundTimer(0);
  }

  private clearRoundTimer() {
    Timers.RemoveTimer(this.createdTimer);
    this.createdTimer = "";
    this.updateRoundTimer(this.maxRoundTimer);
  }

  private updateRoundTimer(newValue: number) {
    this.currentRoundTimer = newValue;
    this.alertRoundTimerUpdated();
    CustomGameEventManager.Send_ServerToAllClients("round_time_updated", {
      maxRoundTimer: this.maxRoundTimer,
      currentRoundTimer: this.currentRoundTimer,
    });
  }

  private alertCycleUpdated(isNowDayTime: boolean) {
    this.onCycleUpdatedHandler.forEach((method) => {
      method(isNowDayTime ? TimeOfDay.Day : TimeOfDay.Night, this.roundPast, this.nightPast);
    });
  }

  private alertRoundTimerUpdated() {
    this.onRoundTimerUpdatedHandler.forEach((method) => {
      method(this.currentRoundTimer);
    });
  }
}
