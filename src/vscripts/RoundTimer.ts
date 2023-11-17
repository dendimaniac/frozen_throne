import { reloadable } from "./lib/tstl-utils";

const dayTime = 0.3;
const nightTime = 0.8;
const startDelay = 5;

@reloadable
export class RoundTimer {
  maxRoundTimer: number = 0;
  currentRoundTimer: number = 0;
  createdTimer: string = "";
  gameMode: CDOTABaseGameMode;

  constructor(maxRoundTimer: number) {
    this.maxRoundTimer = startDelay;
    this.UpdateRoundTimer(startDelay);
    this.StartNewRound(false, maxRoundTimer);
    this.gameMode = GameRules.GetGameModeEntity();
    GameRules.SetTimeOfDay(nightTime);
  }

  private StartNewRound(
    switchDayNight: boolean = true,
    newMaxRoundTimer: number = 0,
    startDelay: number = 0
  ) {
    if (switchDayNight) {
      GameRules.SetTimeOfDay(GameRules.IsDaytime() ? nightTime : dayTime);
    }
    this.createdTimer = Timers.CreateTimer(
      startDelay,
      () => {
        this.UpdateRoundTimer(this.currentRoundTimer - 1);
        if (this.currentRoundTimer === 0) {
          if (newMaxRoundTimer > 0) this.maxRoundTimer = newMaxRoundTimer;
          this.ClearRoundTimer();
          this.StartNewRound(true, 0, 1);
          return;
        }
        return 1;
      },
      this
    );
  }

  public ForceEndRound() {
    this.ClearRoundTimer();
    this.UpdateRoundTimer(0);
  }

  private ClearRoundTimer() {
    Timers.RemoveTimer(this.createdTimer);
    this.createdTimer = "";
    this.UpdateRoundTimer(this.maxRoundTimer);
  }

  private UpdateRoundTimer(newValue: number) {
    this.currentRoundTimer = newValue;
    CustomGameEventManager.Send_ServerToAllClients("round_time_updated", {
      maxRoundTimer: this.maxRoundTimer,
      currentRoundTimer: this.currentRoundTimer,
    });
  }
}
