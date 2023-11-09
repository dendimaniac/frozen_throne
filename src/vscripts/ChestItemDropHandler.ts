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
      "entity_killed",
      (event) => this.OnEntityKilled(event),
      undefined
    );
  }

  private OnEntityKilled(event: EntityKilledEvent) {
    const entityKilled = EntIndexToHScript(
      event.entindex_killed
    ) as CDOTA_BaseNPC;
    const unitName = entityKilled.GetUnitName();
    if (unitName.includes("chest")) {
      const itemSets = this.itemDropsRate[entityKilled.GetUnitLabel()].ItemSets;
      const possibleItemKeys = Object.keys(itemSets);
      const itemName =
        possibleItemKeys[RandomInt(0, possibleItemKeys.length - 1)];
      itemSets[itemName]--;
      print(`TEST: Name: ${itemName}, value: ${itemSets[itemName]}`);
      if (itemSets[itemName] === 0) {
        delete itemSets[itemName];
        DeepPrintTable(this.itemDropsRate);
      }

      const item = CreateItem(itemName, undefined, undefined);
      const pos = entityKilled.GetAbsOrigin();
      CreateItemOnPositionSync(pos, item);
      const pos_launch = (pos + RandomVector(RandomFloat(150, 200))) as Vector;
      item!.LaunchLoot(false, 200, 0.75, pos_launch, undefined);

      if (Object.entries(itemSets).length > 0) {
        CreateUnitByName(
          unitName,
          entityKilled.GetAbsOrigin(),
          true,
          undefined,
          undefined,
          DotaTeam.NEUTRALS
        );
      }
    }
  }
}
