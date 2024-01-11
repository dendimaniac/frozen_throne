GameEvents.Subscribe(
  "round_time_updated",
  ({
    maxRoundTimer,
    currentRoundTimer,
  }: NetworkedData<RoundTimeUpdatedEventData>) => {
    // const sliderPanel = $("#slider");
    // const timerPercentage = (currentRoundTimer / maxRoundTimer) * 100;
    // sliderPanel.style.width = `${timerPercentage}%`;

    const roundTimerText = $("#round-timer-text") as LabelPanel;
    // roundTimerText.text = `${currentRoundTimer} / ${maxRoundTimer}`;
    roundTimerText.text = `${currentRoundTimer}`;
  }
);
