import { reloadable } from "./lib/tstl-utils";

@reloadable
export class RoundTimer {
  maxRoundTimer: number = 0;
  currentRoundTimer: number = 0;
  createdTimer: string = "";

  constructor(maxRoundTimer: number) {
    this.maxRoundTimer = maxRoundTimer;
    this.currentRoundTimer = 0;
  }

  public StartNewRound() {
    this.createdTimer = Timers.CreateTimer(
      {
        callback: () => {
          this.currentRoundTimer++;
          this.SendUpdatedRoundTimer();
          if (this.currentRoundTimer === this.maxRoundTimer) {
            this.ClearRoundTimer();
          }
          return 1;
        },
        useGameTime: true,
      },
      this
    );
  }

  public EndRound() {
    this.ClearRoundTimer();
    this.currentRoundTimer = this.maxRoundTimer;
    this.SendUpdatedRoundTimer();
  }

  private ClearRoundTimer() {
    Timers.RemoveTimer(this.createdTimer);
    this.createdTimer = "";
  }

  private SendUpdatedRoundTimer() {
    CustomGameEventManager.Send_ServerToAllClients("round_time_updated", {
      maxRoundTimer: this.maxRoundTimer,
      currentRoundTimer: this.currentRoundTimer,
    });
  }
}
