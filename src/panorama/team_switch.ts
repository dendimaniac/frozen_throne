class PlayerPortrait {
  panel: Panel;
  selectedHeroesDisplay: TeamSwitchVote;
  heroImage: ImagePanel;
  playerLabel: LabelPanel;
  playerId: PlayerID;

  constructor(
    parent: Panel,
    selectedHeroesDisplay: TeamSwitchVote,
    playerId: PlayerID,
    heroName: string,
    playerName: string
  ) {
    const panel = $.CreatePanel("Panel", parent, "");
    this.selectedHeroesDisplay = selectedHeroesDisplay;
    this.panel = panel;
    this.playerId = playerId;

    panel.BLoadLayoutSnippet("PlayerPortrait");

    this.heroImage = panel.FindChildTraverse("HeroImage") as ImagePanel;
    this.playerLabel = panel.FindChildTraverse("PlayerName") as LabelPanel;
    const voteButton = panel.FindChildTraverse("button_vote") as Button;
    $.Msg(voteButton);
    voteButton.SetPanelEvent("onactivate", this.sendVote.bind(this));

    this.playerLabel.text = playerName;

    this.updateHeroImage(heroName);
  }

  sendVote() {
    if (this.playerId === Players.GetLocalPlayer()) return;

    $.Msg(`Sending vote: ${this.playerId}`);
    GameEvents.SendCustomGameEventToServer("start_player_vote", {
      playerUnderVote: this.playerId,
    });
    this.selectedHeroesDisplay.hideVotes();
  }

  updateHeroImage(heroName: string) {
    this.heroImage.SetImage(
      "s2r://panorama/images/heroes/" + heroName + "_png.vtex"
    );
  }
}

class TeamSwitchVote {
  panel: Panel;
  mainContainer: Panel;
  playerVoteContainer: Panel;
  playerSetting: Record<PlayerID, string>;
  playerPortraits: Record<PlayerID, PlayerPortrait> | undefined;
  playerUnderVote: PlayerID | undefined;
  buttonVoteFor: Button;
  buttonVoteAgainst: Button;
  hasVote: boolean = false;
  localPlayerId: PlayerID;

  constructor(panel: Panel) {
    this.panel = panel;
    this.mainContainer = this.panel.FindChild("main_panel")!;
    this.playerVoteContainer = this.panel.FindChild("player_vote_panel")!;
    this.buttonVoteFor = this.panel.FindChildTraverse("button_vote_for")!;
    this.buttonVoteAgainst = this.panel.FindChildTraverse(
      "button_vote_against"
    )!;
    this.playerSetting = CustomNetTables.GetTableValue(
      "players",
      "selectedHeroes"
    )!;
    this.localPlayerId = Players.GetLocalPlayer();

    this.buttonVoteFor.SetPanelEvent(
      "onactivate",
      this.voteForButton.bind(this)
    );
    this.buttonVoteAgainst.SetPanelEvent(
      "onactivate",
      this.voteAgainstButton.bind(this)
    );
    const container = this.panel.FindChild("show_hide_panel")!;
    container.SetPanelEvent("onmouseover", this.showVotes.bind(this));
    this.mainContainer.SetPanelEvent("onmouseout", this.hideVotes.bind(this));

    this.updatePlayerSetting(
      CustomNetTables.GetTableValue("players", "selectedHeroes")!
    );

    CustomNetTables.SubscribeNetTableListener(
      "players",
      (_, tableKey, value) => {
        $.Msg(`Here: ${tableKey}`);
        if (tableKey === "selectedHeroes") {
          const playerSetting: Record<PlayerID, string> = value as Record<
            PlayerID,
            string
          >;
          this.updatePlayerSetting(playerSetting);
          return;
        }

        if (tableKey === "votes") {
          const votes = value as Votes;
          this.playerUnderVote = votes.playerUnderVote;
          if (this.playerUnderVote === undefined) {
            this.hidePlayerUnderVote();
            return;
          }

          this.showPlayerUnderVote(this.playerSetting[this.playerUnderVote]);
          if (
            Object.values(votes.votedForPlayers).includes(this.localPlayerId)
          ) {
            this.showActiveVoteForButton();
          } else if (
            Object.values(votes.votedAgainstPlayers).includes(
              this.localPlayerId
            )
          ) {
            this.showActiveVoteAgainstButton();
          }
        }
      }
    );
  }

  showActiveVoteForButton() {
    this.buttonVoteAgainst.AddClass("NonActive");
  }

  showActiveVoteAgainstButton() {
    this.buttonVoteFor.AddClass("NonActive");
  }

  clearVoteButtonActive() {
    this.buttonVoteFor.RemoveClass("NonActive");
    this.buttonVoteAgainst.RemoveClass("NonActive");
  }

  voteForButton() {
    this.sendVote("for");
  }

  voteAgainstButton() {
    this.sendVote("against");
  }

  sendVote(vote: VoteChoice) {
    if (this.hasVote) return;

    this.hasVote = true;
    GameEvents.SendCustomGameEventToServer("submit_vote_option", {
      vote,
    });
  }

  showVotes() {
    if (this.playerUnderVote !== undefined) return;

    this.mainContainer.RemoveClass("Hidden");
  }

  hideVotes() {
    this.mainContainer.AddClass("Hidden");
  }

  setHasStartedVotes() {
    this.hasVote = true;
    this.hideVotes();
  }

  showPlayerUnderVote(heroName: string) {
    const heroImage = this.playerVoteContainer.FindChildTraverse(
      "HeroImage"
    ) as ImagePanel;
    heroImage.SetImage(
      "s2r://panorama/images/heroes/" + heroName + "_png.vtex"
    );
    this.playerVoteContainer.RemoveClass("Hidden");
  }

  hidePlayerUnderVote() {
    this.playerVoteContainer.AddClass("Hidden");
    this.clearVoteButtonActive();
  }

  updatePlayerSetting(playerSetting: Record<PlayerID, string>) {
    this.playerSetting = playerSetting;
    this.updateHeroPortraits();
  }

  updateHeroPortraits() {
    const entries = Object.entries(this.playerSetting);
    if (this.playerPortraits === undefined) {
      this.playerPortraits = {} as Record<PlayerID, PlayerPortrait>;
    }

    entries.forEach((player) => {
      if (this.playerPortraits === undefined) {
        $.Warning("Player portraits is undefined somehow. Please check!!!");
        return;
      }

      const playerId = parseInt(player[0]) as PlayerID;
      const heroName = player[1];
      const playerName = Players.GetPlayerName(playerId);
      if (!this.playerPortraits.hasOwnProperty(playerId)) {
        const playerPortrait = new PlayerPortrait(
          this.mainContainer,
          this,
          playerId,
          heroName,
          playerName
        );
        this.playerPortraits[playerId] = playerPortrait;
        return;
      }

      this.playerPortraits[playerId].updateHeroImage(heroName);
    }, {} as Record<PlayerID, PlayerPortrait>);
    return;
  }
}

new TeamSwitchVote($.GetContextPanel());
