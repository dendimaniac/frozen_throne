import { BaseModifier, registerModifier } from "../lib/dota_ts_adapter";
import { modifier_enemy_range_view } from "./modifier_enemy_range_view";
import { modifier_neutral_ai } from "./modifier_neutral_ai";

interface NoiseLocationSetting {
  spawner: CBaseEntity;
  target: CBaseEntity;
  spawnedZombie: CDOTA_BaseNPC | undefined;
}

interface NoiseLocations {
  [key: number]: NoiseLocationSetting;
}

@registerModifier()
export class modifier_chest_noise extends BaseModifier {
  noiseLocationIndex: number = 0;
  noiseLocations!: NoiseLocations;
  indexToCheck!: number[];
  parentName: string = "";

  OnCreated(params: { noiseLocationIndex: number }): void {
    if (IsServer()) {
      this.parentName = this.GetParent().GetUnitName();
      this.noiseLocationIndex = params.noiseLocationIndex;
      const noiseEntities = Entities.FindAllByName(
        `location_noise_${this.noiseLocationIndex}`
      );
      // print(`Noise location: ${params.noiseLocationIndex}`);
      this.noiseLocations = noiseEntities.reduce<NoiseLocations>(
        (prevValue, currentValue) => {
          const index = currentValue.Attribute_GetIntValue("index", 0);
          const target = Entities.FindByName(
            undefined,
            `location_noise_target_${this.noiseLocationIndex}_${index}`
          )!;
          print(`Target: ${target.GetName()}, index: ${index}`);
          prevValue[index] = {
            spawner: currentValue,
            target: target,
            spawnedZombie: undefined,
          };
          return prevValue;
        },
        {}
      );
      this.indexToCheck = Object.keys(this.noiseLocations).map((key) =>
        parseInt(key)
      );

      // print(`${this.GetParent().GetUnitName()}, ${this.noiseLocationIndex}`);
      // DeepPrintTable(this.noiseLocations);
    }
  }

  DeclareFunctions(): ModifierFunction[] {
    return [
      ModifierFunction.ON_ATTACKED,
      ModifierFunction.ABSOLUTE_NO_DAMAGE_MAGICAL,
      ModifierFunction.ABSOLUTE_NO_DAMAGE_PURE,
    ];
  }

  GetAbsoluteNoDamageMagical(_: ModifierAttackEvent): 0 | 1 {
    return 1;
  }

  GetAbsoluteNoDamagePure(_: ModifierAttackEvent): 0 | 1 {
    return 1;
  }

  OnAttacked(event: ModifierAttackEvent): void {
    if (IsServer()) {
      const unitName = event.target.GetUnitName();
      if (unitName !== this.parentName) return;

      let existingUnit: CBaseEntity | undefined;
      let randomIndex: number = 0;
      let isValid: boolean = false;
      let noiseLocationSetting: NoiseLocationSetting | undefined;
      const indexToCheck = [...this.indexToCheck];
      do {
        randomIndex = RandomInt(0, indexToCheck.length - 1);
        noiseLocationSetting = this.noiseLocations[indexToCheck[randomIndex]];
        existingUnit = noiseLocationSetting.spawnedZombie;
        isValid =
          existingUnit === undefined ||
          existingUnit.IsNull() ||
          !existingUnit.IsAlive();
        if (!isValid) indexToCheck.splice(randomIndex, 1);
      } while (!isValid && indexToCheck.length > 0);
      if (indexToCheck.length === 0) return;

      const spawnPosition = noiseLocationSetting.spawner.GetAbsOrigin();
      const patrolPosition = noiseLocationSetting.target.GetAbsOrigin();
      CreateUnitByNameAsync(
        "npc_dota_creature_zombie",
        spawnPosition,
        true,
        undefined,
        undefined,
        DotaTeam.CUSTOM_1,
        (unit) => {
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
          noiseLocationSetting!.spawnedZombie = unit;
        }
      );
    }
  }

  IsHidden(): boolean {
    return true;
  }
}
