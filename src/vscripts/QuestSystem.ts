import { reloadable } from "./lib/tstl-utils";

interface ItemGoal {
  name: string;
  count: number;
}

const possibleGoalItemNames: ItemGoal[] = [
  {
    name: "item_blink_custom",
    count: 10,
  },
  {
    name: "item_gate_repair",
    count: 10,
  },
  {
    name: "item_flask",
    count: 10,
  },
];

@reloadable
export class QuestSystem {
  goalItemSetting: ItemGoal;
  goalItemAdded: number = 0;

  constructor() {
    const randomGoalIndex = RandomInt(0, possibleGoalItemNames.length - 1);
    this.goalItemSetting = possibleGoalItemNames[randomGoalIndex];
    print(
      `TEST: Name: ${this.goalItemSetting.name}, count: ${this.goalItemSetting.count}`
    );

    CustomNetTables.SetTableValue("quest_system", "setting", {
      name: this.goalItemSetting.name,
      count: this.goalItemSetting.count,
    });

    const gameModeEntity = GameRules.GetGameModeEntity();
    gameModeEntity.SetItemAddedToInventoryFilter(
      (event: ItemAddedToInventoryFilterEvent) => {
        const inventoryParent = EntIndexToHScript(
          event.inventory_parent_entindex_const
        ) as CDOTA_BaseNPC | undefined;
        const itemEntIndex = EntIndexToHScript(event.item_entindex_const) as
          | CDOTA_BaseNPC
          | undefined;
        if (
          inventoryParent &&
          inventoryParent.GetUnitName() === "objective_stash"
        ) {
          if (
            itemEntIndex &&
            itemEntIndex.GetName() === this.goalItemSetting.name
          ) {
            print(`ItemEntIndex: ${itemEntIndex.GetName()}`);
            this.goalItemAdded++;
            print(`Goal added: ${this.goalItemAdded}`);
            if (this.goalItemAdded >= this.goalItemSetting.count) {
              GameRules.SetGameWinner(DotaTeam.GOODGUYS);
            }
            return true;
          }
          return false;
        }

        return true;
      },
      this
    );
  }
}
