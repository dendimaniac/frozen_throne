import { reloadable } from "./lib/tstl-utils";
import { modifier_panic } from "./modifiers/modifier_panic";
import { modifier_neutral_ai } from "./modifiers/modifier_neutral_ai";
import { RoundTimer } from "./RoundTimer";
import { ChestItemDropHandler } from "./ChestItemDropHandler";

const heroSelectionTime = 20;
// null will not force a hero selection
const forceHero: string | null = null;
let spawnedZombies: { [key: number]: CDOTA_BaseNPC | undefined } = {};
let viewRangeParticles: (ViewRangeParticles | undefined)[] = [];
const prevPositions: Vector[] = [];

type ViewRangeParticles = {
  entityId: EntityIndex;
  particleId: ParticleID;
};

declare global {
  interface CDOTAGameRules {
    Addon: GameMode;
  }
}

@reloadable
export class GameMode {
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
  }

  public static Activate(this: void) {
    // When the addon activates, create a new instance of this GameMode class.
    GameRules.Addon = new GameMode();
  }

  constructor() {
    this.configure();

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

    CustomGameEventManager.RegisterListener("alt_active", (_, data) => {
      const viewRangeCast = "particles/range_finder_aoe.vpcf";
      const zombies = Object.values(spawnedZombies).flat();
      zombies.map((entity) => {
        if (!entity) return;

        const radius = entity.GetCurrentVisionRange();
        let particle = viewRangeParticles.find(
          (item) => item?.entityId === entity.entindex()
        );
        if (particle === undefined) {
          const effectIndicator = ParticleManager.CreateParticle(
            viewRangeCast,
            ParticleAttachment.ABSORIGIN_FOLLOW,
            entity
          );
          particle = {
            entityId: entity.entindex(),
            particleId: effectIndicator,
          };
          viewRangeParticles.push(particle);
        }
        ParticleManager.SetParticleControl(
          particle.particleId,
          2,
          entity.GetAbsOrigin()
        );
        ParticleManager.SetParticleControl(
          particle.particleId,
          3,
          Vector(radius, 0, 0)
        );
      });
    });

    CustomGameEventManager.RegisterListener("alt_inactive", (_, data) => {
      viewRangeParticles.map((particle) => {
        if (particle === undefined) return;

        ParticleManager.DestroyParticle(particle.particleId, true);
        ParticleManager.ReleaseParticleIndex(particle.particleId);
      });
      viewRangeParticles = [];
    });

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

      // Also apply the panic modifier to the sending player's hero
      // const hero = player.GetAssignedHero();
      // hero.AddNewModifier(hero, undefined, modifier_panic.name, {
      //   duration: 1,
      // });
    });
  }

  private configure(): void {
    GameRules.EnableCustomGameSetupAutoLaunch(true);
    GameRules.SetCustomGameSetupAutoLaunchDelay(0);
    GameRules.SetHeroSelectionTime(10);
    GameRules.SetStrategyTime(0);
    GameRules.SetPreGameTime(0);
    GameRules.SetShowcaseTime(0);
    GameRules.SetPostGameTime(5);
    GameRules.SetHeroSelectionTime(heroSelectionTime);
    const gameModeEntity = GameRules.GetGameModeEntity();
    gameModeEntity.SetFogOfWarDisabled(true);
    gameModeEntity.SetDaynightCycleDisabled(true);

    if (forceHero !== null) {
      gameModeEntity.SetCustomGameForceHero(forceHero);
    }
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
  }

  private StartGame(): void {
    print("Game starting!");

    // Do some stuff here
    const path = "particles/ui_mouseactions/bounding_area_view_a.vpcf";
    const viewRangeCast = "particles/range_finder_aoe.vpcf";
    const spawner = Entities.FindAllByName("zombie_spawner");
    print(`TEST: spawner count: ${spawner.length}`);
    Timers.CreateTimer(() => {
      spawner.map((sp, index) => {
        // if (Object.keys(spawnedZombies).length == 50) return;
        print(`TEST: Spawned count: ${Object.keys(spawnedZombies).length}`);

        const specificSpawnerZombies = spawnedZombies[index];
        if (specificSpawnerZombies !== undefined) return;

        let attempts = 0;
        let distance = 400;
        let spawnPosition = sp.GetAbsOrigin();

        const newZombie = CreateUnitByName(
          "npc_dota_creature_zombie",
          sp.GetAbsOrigin(),
          true,
          undefined,
          undefined,
          DotaTeam.NEUTRALS
        );
        const modelRadius = newZombie.GetModelRadius();
        const hullRadius = newZombie.GetPaddedCollisionRadius();
        const avoidDistance = modelRadius * 2;
        let shouldRetry = false;
        do {
          shouldRetry = false;
          spawnPosition = (sp.GetAbsOrigin() +
            RandomVector(distance)) as Vector;
          spawnPosition = GetGroundPosition(spawnPosition, newZombie);
          attempts++;
          if (attempts > 10) {
            attempts = 0;
            distance -= 50;
          }
          if (distance < 0) {
            distance = 400;
          }
          if (GridNav.IsBlocked(spawnPosition)) shouldRetry = true;
          else if (GridNav.IsNearbyTree(spawnPosition, modelRadius, true))
            shouldRetry = true;
          else if (!GridNav.CanFindPath(sp.GetAbsOrigin(), spawnPosition))
            shouldRetry = true;
          else {
            const hasCollapsingPrev = prevPositions.find(
              (position) =>
                this.GetDistanceBetweenTwoPositions(spawnPosition, position) <
                avoidDistance
            );
            if (hasCollapsingPrev) shouldRetry = true;
          }
          // print(
          //   `TEST: IsBlocked: ${GridNav.IsBlocked(
          //     spawnPosition
          //   )}, CanFindPath: ${!GridNav.CanFindPath(
          //     sp.GetAbsOrigin(),
          //     spawnPosition
          //   )}, IsNearbyTree: ${GridNav.IsNearbyTree(
          //     spawnPosition,
          //     modelRadius,
          //     true
          //   )}`
          // );
        } while (shouldRetry);
        print(
          `TEST: Found length ${
            prevPositions.filter(
              (position) =>
                this.GetDistanceBetweenTwoPositions(spawnPosition, position) <
                avoidDistance
            ).length
          }`
        );
        newZombie.SetAbsOrigin(spawnPosition);
        prevPositions.push(spawnPosition);
        print(``);
        print(`TEST: PAST!`);
        print(``);
        let patrolPosition: Vector = sp.GetAbsOrigin();
        attempts = 0;
        const minDistance = distance;
        distance = distance * 2;
        do {
          shouldRetry = false;
          if (distance < minDistance) {
            distance = minDistance;
          }
          if (attempts > 10) {
            attempts = 0;
            distance -= 50;
          }
          attempts++;
          patrolPosition = (spawnPosition + RandomVector(distance)) as Vector;
          patrolPosition = GetGroundPosition(patrolPosition, newZombie);
          // print(
          //   `TEST: Distance: ${distance}, Attempt: ${attempts} IsBlocked: ${GridNav.IsBlocked(
          //     patrolPosition
          //   )}, CanFindPath: ${!GridNav.CanFindPath(
          //     spawnPosition,
          //     patrolPosition
          //   )}, IsNearbyTree: ${GridNav.IsNearbyTree(
          //     patrolPosition,
          //     modelRadius,
          //     true
          //   )}, PathLength: ${
          //     GridNav.FindPathLength(spawnPosition, patrolPosition) > distance
          //   }`
          // );
          if (GridNav.IsBlocked(patrolPosition)) shouldRetry = true;
          else if (GridNav.IsNearbyTree(patrolPosition, modelRadius, true))
            shouldRetry = true;
          else if (!GridNav.CanFindPath(spawnPosition, patrolPosition))
            shouldRetry = true;
          else if (
            GridNav.FindPathLength(spawnPosition, patrolPosition) > distance
          )
            shouldRetry = true;
          // else {
          //   const hasCollapsingPrev = prevPositions.find(
          //     (position) =>
          //       this.GetDistanceBetweenTwoPositions(patrolPosition, position) <
          //       avoidDistance
          //   );
          //   if (hasCollapsingPrev) shouldRetry = true;
          // }
        } while (shouldRetry);
        print(
          `TEST: Found length ${
            prevPositions.filter(
              (position) =>
                this.GetDistanceBetweenTwoPositions(patrolPosition, position) <
                avoidDistance
            ).length
          }`
        );
        // prevPositions.map((position) => {
        //   if (position === spawnPosition || position === patrolPosition) return;

        //   print(
        //     `TEST: Patrol closeby: ${
        //       GridNav.FindPathLength(position, patrolPosition) < hullRadius
        //     }, radius: ${hullRadius}`
        //   );
        // });
        prevPositions.push(patrolPosition);
        print(``);
        print(`TEST: DONEEE!`);
        print(``);
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
        ParticleManager.SetParticleControl(effectIndicator, 2, spawnPosition);
        ParticleManager.SetParticleControl(
          effectIndicator,
          3,
          Vector(modelRadius, 0, 0)
        );

        newZombie.AddNewModifier(newZombie, undefined, "modifier_phased", {
          duration: 0.03,
        });

        const aiLogic = newZombie.AddNewModifier(
          newZombie,
          undefined,
          modifier_neutral_ai.name,
          {
            aggroRange: newZombie.GetAcquisitionRange(),
            leashRange: newZombie.GetAcquisitionRange(),
          }
        ) as modifier_neutral_ai;
        aiLogic.secondPatrol = patrolPosition;
        aiLogic.targetPatrol = patrolPosition;
        spawnedZombies[index] = newZombie;
      });
      return 10.0;
    });

    let position = (spawner[0].GetAbsOrigin() + RandomVector(100)) as Vector;
    CreateUnitByName(
      "chest_hospital",
      position,
      true,
      undefined,
      undefined,
      DotaTeam.NEUTRALS
    );

    position = (spawner[0].GetAbsOrigin() + RandomVector(200)) as Vector;
    CreateUnitByName(
      "chest_police_station",
      position,
      true,
      undefined,
      undefined,
      DotaTeam.NEUTRALS
    );

    new RoundTimer(10);
  }

  // Called on script_reload
  public Reload() {
    print("Script reloaded!");

    // Do some stuff here
  }

  private GetDistanceBetweenTwoPositions(
    firstPosition: Vector,
    secondPosition: Vector
  ) {
    return ((firstPosition - secondPosition) as Vector).Length();
  }

  private OnEntityKilled(event: EntityKilledEvent) {
    const zombieKilled = EntIndexToHScript(
      event.entindex_killed
    ) as CDOTA_BaseNPC;
    if (zombieKilled.GetUnitLabel() === "zombie") {
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
      const particle = viewRangeParticles.find(
        (item) => item?.entityId === event.entindex_killed
      );
      if (particle) {
        ParticleManager.DestroyParticle(particle.particleId, true);
        ParticleManager.ReleaseParticleIndex(particle.particleId);
        viewRangeParticles = viewRangeParticles.splice(
          viewRangeParticles.indexOf(particle),
          1
        );
      }
    }
  }

  private OnPlayerHeroKilled(event: DotaPlayerKilledEvent) {
    const player = PlayerResource.GetPlayer(event.PlayerID);
    if (player) {
      const hero = player.GetAssignedHero();
      hero.SetTimeUntilRespawn(0);
      for (let i = 0; i < 9; i++) {
        const item = hero.GetItemInSlot(i);
        if (item) {
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
    const oldHero = EntIndexToHScript(event.entindex) as CDOTA_BaseNPC_Hero;
    if (oldHero && oldHero.IsRealHero()) {
      oldHero.AddItemByName("item_blink");
      if (event.is_respawn > 0) {
        const playerId = oldHero.GetPlayerOwnerID();
        PlayerResource.ReplaceHeroWith(
          playerId,
          "npc_dota_hero_meepo",
          oldHero.GetGold(),
          oldHero.GetCurrentXP()
        );
      }
    }
  }
}
