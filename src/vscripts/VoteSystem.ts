import { reloadable } from "./lib/tstl-utils";

@reloadable
export class VoteSystem {
  constructor() {
    CustomGameEventManager.RegisterListener("start_player_vote", (_, data) => {
      print(
        `Received vote from: ${data.PlayerID} for: ${data.playerUnderVote}`
      );
      const currentVotes = CustomNetTables.GetTableValue("players", "votes");
      // if (
      //   currentVotes !== undefined &&
      //   currentVotes.playerUnderVote !== undefined
      // ) {
      //   error("Trying to vote while another under vote");
      // }

      const votedForPlayers = {
        0: data.PlayerID,
      };
      const votedAgainstPlayers = {
        0: data.playerUnderVote,
      };
      CustomNetTables.SetTableValue("players", "votes", {
        playerUnderVote: data.playerUnderVote,
        votedForPlayers,
        votedAgainstPlayers,
      });

      this.sendEndVoteIfNeeded(data.playerUnderVote, 1, 1);
    });

    CustomGameEventManager.RegisterListener("submit_vote_option", (_, data) => {
      const playerCastingVote = data.PlayerID;
      const currentVotes = CustomNetTables.GetTableValue(
        "players",
        "votes"
      ) as Votes;
      const votedForPlayers = Object.values(currentVotes.votedForPlayers);
      const votedAgainstPlayers = Object.values(
        currentVotes.votedAgainstPlayers
      );
      if (data.vote === "for") {
        votedForPlayers.push(playerCastingVote);
      } else {
        votedAgainstPlayers.push(playerCastingVote);
      }

      CustomNetTables.SetTableValue("players", "votes", currentVotes);
    });
  }

  sendEndVoteIfNeeded(
    playerUnderVote: PlayerID,
    votedForPlayerCount: number,
    votedAgainstPlayerCount: number
  ) {
    const players = CustomNetTables.GetTableValue("players", "selectedHeroes");
    const maxPlayerCount = Object.values(players).length;
    const halfPlayerCount = Math.floor(maxPlayerCount / 2);
    const canEndVote =
      votedForPlayerCount + votedAgainstPlayerCount === maxPlayerCount ||
      votedForPlayerCount > halfPlayerCount ||
      votedAgainstPlayerCount > halfPlayerCount;
    if (canEndVote) {
      Timers.CreateTimer(3, () => {
        const hero = PlayerResource.GetSelectedHeroEntity(playerUnderVote)!;
        hero.SetTeam(DotaTeam.BADGUYS);
        const direSpawn = FindSpawnEntityForTeam(DotaTeam.BADGUYS)!;
        FindClearSpaceForUnit(hero, direSpawn.GetAbsOrigin(), true);
        PlayerResource.SetCustomTeamAssignment(
          playerUnderVote,
          DotaTeam.BADGUYS
        );
        CustomNetTables.SetTableValue("players", "votes", {
          playerUnderVote: undefined,
          votedForPlayers: {},
          votedAgainstPlayers: {},
        });
      });
    }
  }
}
