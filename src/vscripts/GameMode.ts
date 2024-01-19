import { reloadable } from "./lib/tstl-utils";
import { modifier_panic } from "./modifiers/modifier_panic";
import { modifier_neutral_ai } from "./modifiers/modifier_neutral_ai";
import { RoundTimer, TimeOfDay } from "./RoundTimer";
import { ChestItemDropHandler } from "./ChestItemDropHandler";
import { modifier_no_health_regen } from "./modifiers/modifier_no_health_regen";
import { modifier_enemy_range_view } from "./modifiers/modifier_enemy_range_view";
import { modifier_gate_under_attack } from "./modifiers/modifier_gate_under_attack";
import { modifier_chest_noise } from "./modifiers/modifier_chest_noise";
import { ability_chest_noise } from "./abilities/units/ability_chest_noise";
import { QuestSystem } from "./QuestSystem";
import { modifier_permanent_phased } from "./modifiers/modifier_permanent_phased";
import { VoteSystem } from "./VoteSystem";

const heroSelectionTime = 20;
// null will not force a hero selection
const forceHero: string | null = null;
let spawnedZombies: { [key: number]: CDOTA_BaseNPC | undefined } = {};

type ViewRangeParticles = {
  entityId: EntityIndex;
  particleId: ParticleID;
};

interface HeroList {
  [key: string]: number;
}

declare global {
  interface CDOTAGameRules {
    Addon: GameMode;
  }
}

@reloadable
export class GameMode {
  wasRespawned: boolean;
  gateEntities: CDOTA_BaseNPC[] = [];
  gatePositions: Vector[] = [];
  gateZombieSpawners: CBaseEntity[] = [];
  gateKilled: number = 0;
  heroList: string[] = [];

  public static Precache(this: void, context: CScriptPrecacheContext) {
    PrecacheResource(
      "particle",
      "particles/units/heroes/hero_meepo/meepo_earthbind_projectile_fx.vpcf",
      context
    );
    PrecacheResource("particle", "particles/range_finder_aoe.vpcf", context);
    PrecacheResource(
      "particle",
      "particles/ui_mouseactions/bounding_area_view_a.vpcf",
      context
    );
    PrecacheResource(
      "soundfile",
      "soundevents/game_sounds_heroes/game_sounds_meepo.vsndevts",
      context
    );
    PrecacheResource(
      "model",
      "models/heroes/undying/undying_minion.vmdl",
      context
    );
    PrecacheResource(
      "model",
      "models/props_gameplay/treasure_chest001.vmdl",
      context
    );
    PrecacheResource(
      "model",
      "models/props_generic/chest_treasure_04.vmdl",
      context
    );
  }

  public static Activate(this: void) {
    // When the addon activates, create a new instance of this GameMode class.
    GameRules.Addon = new GameMode();
  }

  constructor() {
    this.configure();

    this.wasRespawned = false;

    // Register event listeners for dota engine events
    ListenToGameEvent(
      "game_rules_state_change",
      () => this.OnStateChange(),
      undefined
    );
    ListenToGameEvent(
      "entity_killed",
      (event) => this.OnEntityKilled(event),
      undefined
    );
    ListenToGameEvent(
      "dota_player_killed",
      (event) => this.OnPlayerHeroKilled(event),
      undefined
    );
    ListenToGameEvent(
      "npc_spawned",
      (event) => this.OnNpcSpawned(event),
      undefined
    );

    // Register event listeners for events from the UI
    CustomGameEventManager.RegisterListener("ui_panel_closed", (_, data) => {
      print(`Player ${data.PlayerID} has closed their UI panel.`);

      // Respond by sending back an example event
      const player = PlayerResource.GetPlayer(data.PlayerID)!;
      // const hero = player.GetAssignedHero();
      // const opposingTeam = hero.GetOpposingTeamNumber();
      // hero.ChangeTeam(opposingTeam);
      // hero.SetTeam(opposingTeam);
      // PlayerResource.SetCustomTeamAssignment(data.PlayerID, opposingTeam);
      CustomGameEventManager.Send_ServerToPlayer(player, "example_event", {
        myNumber: 42,
        myBoolean: true,
        myString: "Hello!",
        myArrayOfNumbers: [1.414, 2.718, 3.142],
      });
    });
  }

  private configure(): void {
    GameRules.EnableCustomGameSetupAutoLaunch(true);
    GameRules.SetCustomGameSetupAutoLaunchDelay(0);
    GameRules.SetHeroSelectionTime(heroSelectionTime);
    GameRules.SetHeroSelectPenaltyTime(0);
    GameRules.SetStrategyTime(0);
    GameRules.SetPreGameTime(0);
    GameRules.SetShowcaseTime(0);
    GameRules.SetPostGameTime(5);
    // GameRules.SetSameHeroSelectionEnabled(true);
    const gameModeEntity = GameRules.GetGameModeEntity();
    gameModeEntity.SetFogOfWarDisabled(false);
    gameModeEntity.SetDaynightCycleDisabled(true);
    gameModeEntity.SetCustomAttributeDerivedStatValue(
      AttributeDerivedStats.STRENGTH_HP_REGEN,
      0
    );
    gameModeEntity.SetBuybackEnabled(false);
    gameModeEntity.SetRandomHeroBonusItemGrantDisabled(true);

    if (forceHero !== null) {
      gameModeEntity.SetCustomGameForceHero(forceHero);
    }

    gameModeEntity.SetDamageFilter((event: DamageFilterEvent) => {
      const victim = EntIndexToHScript(
        event.entindex_victim_const
      ) as CDOTA_BaseNPC;
      if (victim.GetUnitName().includes("chest")) {
        event.damage = 1;
      }
      return true;
    }, this);

    gameModeEntity.SetHUDVisible(HudVisibility.VISIBILITY_TOP_TIMEOFDAY, false);
    gameModeEntity.SetHUDVisible(
      HudVisibility.VISIBILITY_INVENTORY_QUICKBUY,
      false
    );
    gameModeEntity.SetHUDVisible(
      HudVisibility.VISIBILITY_INVENTORY_COURIER,
      false
    );
    gameModeEntity.SetHUDVisible(
      HudVisibility.VISIBILITY_INVENTORY_GOLD,
      false
    );
    gameModeEntity.SetHUDVisible(
      HudVisibility.VISIBILITY_INVENTORY_SHOP,
      false
    );
    gameModeEntity.SetHUDVisible(HudVisibility.VISIBILITY_KILLCAM, false);
    gameModeEntity.SetHUDVisible(HudVisibility.VISIBILITY_TOP_BAR_SCORE, false);
    gameModeEntity.SetHUDVisible(
      HudVisibility.VISIBILITY_AGHANIMS_STATUS,
      false
    );

    new VoteSystem();
    new QuestSystem();
    new ChestItemDropHandler();
  }

  public OnStateChange(): void {
    const state = GameRules.State_Get();

    if (state === GameState.CUSTOM_GAME_SETUP) {
      // Automatically skip setup in tools
      if (IsInToolsMode()) {
        Timers.CreateTimer(3, () => {
          GameRules.FinishCustomGameSetup();
        });
      }
    }

    // Start game once pregame hits
    if (state === GameState.PRE_GAME) {
      Timers.CreateTimer(0.2, () => this.StartGame());
    }

    if (state === GameState.STRATEGY_TIME) {
      let playerSetting = {} as PlayerSetting;
      for (
        let playerIndex: PlayerID = 0;
        playerIndex < DOTA_MAX_TEAM_PLAYERS;
        playerIndex++
      ) {
        const playerId = playerIndex as PlayerID;
        const player = PlayerResource.GetPlayer(playerId);
        if (player !== undefined) {
          if (!PlayerResource.HasSelectedHero(playerId)) {
            player.MakeRandomHeroSelection();
          }
          playerSetting[playerId] =
            PlayerResource.GetSelectedHeroName(playerId);
        }
      }
      CustomNetTables.SetTableValue("players", "selectedHeroes", playerSetting);
    }
  }

  private StartGame(): void {
    print("Game starting!");

    const player = PlayerResource.GetPlayer(0);
    print(
      `${player?.GetAssignedHero()} ${PlayerResource.GetSelectedHeroName(0)}`
    );

    const heroList = LoadKeyValues("scripts/npc/herolist.txt") as HeroList;
    this.heroList = Object.keys(heroList);
    // DeepPrintTable(this.heroList);

    // Do some stuff here
    const availableLocations = [
      "hospital",
      "police_station",
      "grocery_store",
      "school",
      "library",
      "gas_station",
    ];
    const path = "particles/ui_mouseactions/bounding_area_view_a.vpcf";
    const viewRangeCast = "particles/range_finder_aoe.vpcf";
    const spawner = Entities.FindAllByName("zombie_spawner");
    const patrolTargets = Entities.FindAllByName("patrol_target");
    const itemSpawners = Entities.FindAllByName("chest_spawner");
    itemSpawners.forEach((sp) => {
      if (availableLocations.length === 0) return;
      const isSpawnerEnabled = sp.Attribute_GetIntValue("isEnabled", 0) > 0;
      if (!isSpawnerEnabled) return;

      const randomLocationIndex = RandomInt(0, availableLocations.length - 1);
      const locationName = availableLocations[randomLocationIndex];
      const noiseLocationIndex = sp.Attribute_GetIntValue("location", 0);
      CreateUnitByNameAsync(
        `chest_${locationName}`,
        sp.GetAbsOrigin(),
        true,
        undefined,
        undefined,
        DotaTeam.CUSTOM_1,
        (chest) => {
          const chestNoiseModifier = chest.FindModifierByName(
            modifier_chest_noise.name
          ) as modifier_chest_noise;
          chestNoiseModifier.SetNoiseLocationIndex(noiseLocationIndex);
        }
      );
      availableLocations.splice(randomLocationIndex, 1);
    });

    Timers.CreateTimer(() => {
      spawner.map((sp, index) => {
        // if (index > 10) return;
        // print(`TEST: Spawned count: ${Object.keys(spawnedZombies).length}`);

        const specificSpawnerZombies = spawnedZombies[index];
        if (specificSpawnerZombies !== undefined) return;

        const spawnPosition = sp.GetAbsOrigin();
        const target = patrolTargets[index];
        const patrolPosition = target.GetAbsOrigin();

        CreateUnitByNameAsync(
          "npc_dota_creature_zombie",
          spawnPosition,
          true,
          undefined,
          undefined,
          DotaTeam.CUSTOM_1,
          (unit) => {
            const modelRadius = unit.GetModelRadius();
            const pathEffectIndicator = ParticleManager.CreateParticle(
              path,
              ParticleAttachment.WORLDORIGIN,
              undefined
            );
            ParticleManager.SetParticleControl(
              pathEffectIndicator,
              0,
              spawnPosition
            );
            ParticleManager.SetParticleControl(
              pathEffectIndicator,
              1,
              patrolPosition
            );
            ParticleManager.SetParticleControl(
              pathEffectIndicator,
              15,
              Vector(255, 0, 0)
            );

            const effectIndicator = ParticleManager.CreateParticle(
              viewRangeCast,
              ParticleAttachment.WORLDORIGIN,
              undefined
            );
            ParticleManager.SetParticleControl(
              effectIndicator,
              2,
              spawnPosition
            );
            ParticleManager.SetParticleControl(
              effectIndicator,
              3,
              Vector(modelRadius, 0, 0)
            );

            unit.AddNewModifier(unit, undefined, "modifier_phased", {
              duration: FrameTime(),
            });
            unit.AddNewModifier(
              unit,
              undefined,
              modifier_enemy_range_view.name,
              undefined
            );

            const aiLogic = unit.AddNewModifier(
              unit,
              undefined,
              modifier_neutral_ai.name,
              {
                aggroRange: unit.GetAcquisitionRange(),
                leashRange: unit.GetAcquisitionRange(),
              }
            ) as modifier_neutral_ai;
            aiLogic.secondPatrol = patrolPosition;
            aiLogic.targetPatrol = patrolPosition;
            spawnedZombies[index] = unit;
          }
        );
      });
      return 10.0;
    });

    const objectStashPoint = Entities.FindByName(
      undefined,
      "objective_stash_location"
    )!;
    CreateUnitByNameAsync(
      `objective_stash`,
      objectStashPoint.GetAbsOrigin(),
      true,
      undefined,
      undefined,
      DotaTeam.GOODGUYS,
      (stash) => {
        stash.AddNewModifier(
          stash,
          undefined,
          "modifier_invulnerable",
          undefined
        );
      }
    );

    this.gateEntities = Entities.FindAllByName("gate") as CDOTA_BaseNPC[];
    this.gateEntities.forEach((gate) => {
      this.gatePositions.push(gate!.GetAbsOrigin());
      gate.AddNewModifier(
        gate,
        undefined,
        modifier_permanent_phased.name,
        undefined
      );
      gate.AddNewModifier(
        gate,
        undefined,
        modifier_gate_under_attack.name,
        undefined
      );
    });
    this.gateZombieSpawners = Entities.FindAllByName("gate_zombie_spawner");

    const roundTimer = new RoundTimer(5, 30);
    roundTimer.addOnCycleUpdatedHandler((timeOfDay, roundPast, nightPast) => {
      if (timeOfDay === TimeOfDay.Day) return;
      if (this.gateEntities.length === 0) return;

      const randomGateIndex = [
        RandomInt(0, this.gateEntities.length - 1),
        RandomInt(0, this.gateEntities.length - 1),
      ];
      const zombieToSpawn = Math.floor(nightPast / 3);
      randomGateIndex.forEach((gateIndex) => {
        const indexCopy = gateIndex;
        const gate = this.gateEntities[indexCopy];
        const spawner = this.gateZombieSpawners[indexCopy];
        const isGateActive = !gate.IsNull() && gate.IsAlive();
        if (isGateActive) gate.MakeVisibleToTeam(DotaTeam.CUSTOM_1, 5);
        for (let zomIndex = 0; zomIndex < zombieToSpawn; zomIndex++) {
          CreateUnitByNameAsync(
            "npc_dota_creature_zombie_night",
            spawner.GetAbsOrigin(),
            true,
            undefined,
            undefined,
            DotaTeam.CUSTOM_1,
            (zombie) => {
              zombie.AddNewModifier(zombie, undefined, "modifier_phased", {
                duration: FrameTime(),
              });
              Timers.CreateTimer(FrameTime(), () => {
                if (!isGateActive) {
                  zombie.MoveToPosition(this.gatePositions[indexCopy]);
                  return;
                }

                zombie.MoveToTargetToAttack(gate);
              });
            }
          );
        }
      });
    });
  }

  // Called on script_reload
  public Reload() {
    print("Script reloaded!");

    // Do some stuff here
  }

  private OnEntityKilled(event: EntityKilledEvent) {
    const entityKilled = EntIndexToHScript(
      event.entindex_killed
    ) as CDOTA_BaseNPC;
    const unitLabel = entityKilled.GetUnitLabel();
    if (unitLabel === "zombie") {
      const spawnerKeys = Object.keys(spawnedZombies);
      spawnerKeys.map((key) => {
        const keyAsInt = parseInt(key);
        const specificSpawnerZombies = spawnedZombies[keyAsInt];
        if (
          !specificSpawnerZombies ||
          specificSpawnerZombies.entindex() !== event.entindex_killed
        )
          return;

        spawnedZombies[keyAsInt] = undefined;

        // const zombieIndex = specificSpawnerZombies.findIndex(
        //   (entity) => entity.entindex() === event.entindex_killed
        // );
        // if (zombieIndex > -1) specificSpawnerZombies.splice(zombieIndex, 1);
      });
    } else if (unitLabel === "gate") {
      this.gateKilled++;
      const gateIndex = this.gateEntities.findIndex(
        (gate) => gate.entindex() === event.entindex_killed
      );
      this.gateEntities.splice(gateIndex, 1);
      this.gateZombieSpawners.splice(gateIndex, 1);
      if (this.gateKilled === this.gatePositions.length) {
        GameRules.MakeTeamLose(DotaTeam.GOODGUYS);
      }
    }
  }

  private OnPlayerHeroKilled(event: DotaPlayerKilledEvent) {
    const player = PlayerResource.GetPlayer(event.PlayerID);
    if (player) {
      const hero = player.GetAssignedHero();
      const canRespawn = this.heroList.length > 0;
      if (canRespawn) hero.SetTimeUntilRespawn(3);
      else {
        hero.SetRespawnsDisabled(!canRespawn);
        let disabledCount = 0;
        for (
          let playerIndex: PlayerID = 0;
          playerIndex < DOTA_MAX_TEAM_PLAYERS;
          playerIndex++
        ) {
          const playerId = playerIndex as PlayerID;
          const player = PlayerResource.GetPlayer(playerId);
          if (
            player !== undefined &&
            player.GetAssignedHero().GetRespawnsDisabled()
          ) {
            disabledCount++;
          }
        }
        if (
          disabledCount ===
          PlayerResource.GetPlayerCountForTeam(DotaTeam.GOODGUYS)
        ) {
          GameRules.MakeTeamLose(DotaTeam.GOODGUYS);
          return;
        }
      }
      for (let i = 0; i < 9; i++) {
        const item = hero.GetItemInSlot(i);
        if (item) {
          hero.RemoveItem(item);
          const itemToDrop = CreateItem(item.GetName(), undefined, undefined);
          const pos = hero.GetAbsOrigin();
          CreateItemOnPositionSync(pos, itemToDrop);
          const pos_launch = (pos +
            RandomVector(RandomFloat(150, 200))) as Vector;
          itemToDrop!.LaunchLoot(false, 200, 0.75, pos_launch, undefined);
        }
      }
    }
  }

  private OnNpcSpawned(event: NpcSpawnedEvent) {
    const spawnedUnit = EntIndexToHScript(event.entindex) as CDOTA_BaseNPC_Hero;
    if (spawnedUnit !== undefined) {
      if (!spawnedUnit.IsRealHero()) return;

      spawnedUnit.AddNewModifier(
        spawnedUnit,
        undefined,
        modifier_no_health_regen.name,
        undefined
      );
      const oldHeroName = spawnedUnit.GetName();
      const playerId = spawnedUnit.GetPlayerOwnerID();
      if (event.is_respawn > 0) {
        this.wasRespawned = true;
        const heroNameIndex = RandomInt(0, this.heroList.length - 1);
        const heroName =
          this.heroList.length === 0
            ? oldHeroName
            : this.heroList[heroNameIndex];
        const oldHeroXP = spawnedUnit.GetCurrentXP();
        PlayerResource.ReplaceHeroWith(
          playerId,
          heroName,
          spawnedUnit.GetGold(),
          oldHeroXP
        );
        const playerSetting = CustomNetTables.GetTableValue(
          "players",
          "selectedHeroes"
        );
        playerSetting[playerId] = heroName;
        CustomNetTables.SetTableValue(
          "players",
          "selectedHeroes",
          playerSetting
        );
        const player = PlayerResource.GetPlayer(playerId)!;
        player
          .GetAssignedHero()
          .AddExperience(oldHeroXP, ModifyXpReason.UNSPECIFIED, false, true);
      } else {
        if (!this.wasRespawned) {
          spawnedUnit.AddItemByName("item_gate_repair");
        }
        this.heroList = this.heroList.filter((name) => name !== oldHeroName);
        this.wasRespawned = false;
      }
    }
  }
}
