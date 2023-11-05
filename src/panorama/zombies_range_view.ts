let wasAltActive = false;

(function () {
  $.RegisterForUnhandledEvent("DOTAHudUpdate", () => {
    if (GameUI.IsAltDown()) {
      GameEvents.SendCustomGameEventToServer("alt_active", {});
      wasAltActive = true;
    } else if (wasAltActive && !GameUI.IsAltDown()) {
      GameEvents.SendCustomGameEventToServer("alt_inactive", {});
      wasAltActive = false;
    }
  });
})();
