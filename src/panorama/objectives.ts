function UpdateQuestInfo(value: { name: string; count: number }) {
  $.Msg(`Quest item name: ${value.name}, count: ${value.count}`);
  const roundTimerText = $("#main-quest-text") as LabelPanel;
  roundTimerText.SetDialogVariableInt("count", value.count);
  roundTimerText.SetDialogVariable(
    "name",
    $.Localize(`#DOTA_Tooltip_Ability_${value.name}`)
  );
}

UpdateQuestInfo(CustomNetTables.GetTableValue("quest_system", "setting")!);
