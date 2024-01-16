import { reloadable } from "./lib/tstl-utils";

interface ItemsDrop {
  [key: string]: { ItemSets: { [key: string]: number } };
}

@reloadable
export class ChestItemDropHandler {
  itemDropsRate: ItemsDrop;

  constructor() {
    this.itemDropsRate = LoadKeyValues("scripts/kv/item_drops.kv") as ItemsDrop;
    ListenToGameEvent(
      "entity_hurt",
      (event) => this.OnEntityHurt(event),
      undefined
    );
    ListenToGameEvent(
      "npc_spawned",
      (event) => this.OnNpcSpawned(event),
      undefined
    );
  }

  private OnEntityHurt(event: EntityHurtEvent) {
    const entityKilled = EntIndexToHScript(
      event.entindex_killed
    ) as CDOTA_BaseNPC;
    const unitName = entityKilled.GetUnitName();
    if (unitName.includes("chest")) {
      const itemSets = this.itemDropsRate[entityKilled.GetUnitLabel()].ItemSets;
      const possibleItemKeys = Object.keys(itemSets);
      const mappedItemKeys = possibleItemKeys.reduce<string[]>(
        (prevVal, currentVal) => {
          const currentCount = itemSets[currentVal];
          for (let index = 0; index < currentCount; index++) {
            prevVal = prevVal.concat(currentVal);
          }
          return prevVal;
        },
        []
      );
      // DeepPrintTable(mappedItemKeys);
      const itemName = mappedItemKeys[RandomInt(0, mappedItemKeys.length - 1)];
      itemSets[itemName]--;
      // print(`TEST: Name: ${itemName}, value: ${itemSets[itemName]}`);
      if (itemSets[itemName] === 0) {
        delete itemSets[itemName];
        // DeepPrintTable(this.itemDropsRate);
      }

      const item = CreateItem(itemName, undefined, undefined);
      const pos = entityKilled.GetAbsOrigin();
      CreateItemOnPositionSync(pos, item);
      const pos_launch = (pos + RandomVector(RandomFloat(150, 200))) as Vector;
      item!.LaunchLoot(false, 200, 0.75, pos_launch, undefined);
    }
  }

  OnNpcSpawned(event: NpcSpawnedEvent): void {
    const entitySpawned = EntIndexToHScript(event.entindex) as CDOTA_BaseNPC;
    const unitName = entitySpawned.GetUnitName();
    if (unitName.includes("chest")) {
      const itemSets =
        this.itemDropsRate[entitySpawned.GetUnitLabel()].ItemSets;
      const possibleItemNames = Object.keys(itemSets);
      let maxItemCount = 0;
      possibleItemNames
        .sort((a, b) => {
          if (itemSets[a] > itemSets[b]) return -1;
          if (itemSets[b] > itemSets[a]) return 1;
          return 0;
        })
        .map((itemName) => {
          maxItemCount += itemSets[itemName];
          entitySpawned.AddItemByName(itemName);
        });
      entitySpawned.SetBaseMaxHealth(maxItemCount);
      entitySpawned.ModifyHealth(maxItemCount, undefined, false, 0);
    }
  }
}
