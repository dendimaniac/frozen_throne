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
    this.UpdateRoundTimer(0);
    this.StartNewRound(false);
    this.gameMode = GameRules.GetGameModeEntity();
    GameRules.SetTimeOfDay(nightTime);

    Timers.CreateTimer(startDelay, () => {
      this.ClearRoundTimer();
      this.maxRoundTimer = maxRoundTimer;
      this.StartNewRound();
    });
  }

  private StartNewRound(switchDayNight: boolean = true) {
    if (switchDayNight) {
      GameRules.SetTimeOfDay(GameRules.IsDaytime() ? nightTime : dayTime);
    }
    this.createdTimer = Timers.CreateTimer(
      {
        callback: () => {
          if (this.currentRoundTimer === this.maxRoundTimer) {
            this.ClearRoundTimer();
            this.StartNewRound();
            return;
          }
          this.UpdateRoundTimer(this.currentRoundTimer + 1);
          return 1;
        },
        useGameTime: true,
      },
      this
    );
  }

  public ForceEndRound() {
    this.ClearRoundTimer();
    this.UpdateRoundTimer(this.maxRoundTimer);
  }

  private ClearRoundTimer() {
    Timers.RemoveTimer(this.createdTimer);
    this.createdTimer = "";
    this.UpdateRoundTimer(0);
  }

  private UpdateRoundTimer(newValue: number) {
    this.currentRoundTimer = newValue;
    CustomGameEventManager.Send_ServerToAllClients("round_time_updated", {
      maxRoundTimer: this.maxRoundTimer,
      currentRoundTimer: this.currentRoundTimer,
    });
  }
}
