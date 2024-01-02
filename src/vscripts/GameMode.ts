import { reloadable } from "./lib/tstl-utils";
import { modifier_panic } from "./modifiers/modifier_panic";
import { modifier_neutral_ai } from "./modifiers/modifier_neutral_ai";
import { RoundTimer } from "./RoundTimer";
import { ChestItemDropHandler } from "./ChestItemDropHandler";
import { modifier_no_health_regen } from "./modifiers/modifier_no_health_regen";

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

      // const gateEntities = Entities.FindAllByName("gate") as CDOTA_BaseNPC[];
      // gateEntities.forEach((gate) => {
      //   gate.RemoveModifierByName("modifier_invulnerable");
      // });

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
    gameModeEntity.SetCustomAttributeDerivedStatValue(AttributeDerivedStats.STRENGTH_HP_REGEN, 0)

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
    print(`TEST: spawner count: ${spawner.length}`);
    print(`TEST: patrolTargets count: ${patrolTargets.length}`);
    itemSpawners.forEach((sp) => {
      if (availableLocations.length === 0) return;
      const isSpawnerEnabled = sp.Attribute_GetIntValue("isEnabled", 0) > 0;
      if (!isSpawnerEnabled) return;

      const spawnPosition = (sp.GetAbsOrigin() + RandomVector(100)) as Vector;
      const randomLocationIndex = RandomInt(0, availableLocations.length - 1);
      const location = availableLocations[randomLocationIndex];
      CreateUnitByName(
        `chest_${location}`,
        spawnPosition,
        true,
        undefined,
        undefined,
        DotaTeam.NEUTRALS
      );
      availableLocations.splice(randomLocationIndex, 1);
    });
    Timers.CreateTimer(() => {
      spawner.map((sp, index) => {
        // if (Object.keys(spawnedZombies).length == 50) return;
        // print(`TEST: Spawned count: ${Object.keys(spawnedZombies).length}`);

        const specificSpawnerZombies = spawnedZombies[index];
        if (specificSpawnerZombies !== undefined) return;

        let spawnPosition = sp.GetAbsOrigin();
        const target = patrolTargets[index];
        let patrolPosition = target.GetAbsOrigin();

        const newZombie = CreateUnitByName(
          "npc_dota_creature_zombie",
          spawnPosition,
          true,
          undefined,
          undefined,
          DotaTeam.NEUTRALS
        );
        const modelRadius = newZombie.GetModelRadius();
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

    new RoundTimer(10);
  }

  // Called on script_reload
  public Reload() {
    print("Script reloaded!");

    // Do some stuff here
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
      oldHero.AddNewModifier(
        oldHero,
        undefined,
        modifier_no_health_regen.name,
        undefined
      );
      print(`TEST: Weaver: ${oldHero.GetModifierNameByIndex(0)}`);
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
