
const $ = (id) => document.getElementById(id);

const screens = [
  "setupScreen",
  "passScreen",
  "gameScreen",
  "resultScreen",
  "leaderboardScreen"
];

const COLORS = ["RED", "BLUE", "YELLOW", "GREEN"];

const COLOR_NAMES = {
  RED: "Red",
  BLUE: "Blue",
  YELLOW: "Yellow",
  GREEN: "Green"
};

const COLOR_EMOJI = {
  RED: "🔴",
  BLUE: "🔵",
  YELLOW: "🟡",
  GREEN: "🟢"
};

const state = {
  players: [],
  currentIndex: 0,
  roundForPlayer: 1,
  roundsPerPlayer: 5,
  turnDuration: 5,
  timerInterval: null,
  switchTimeout: null,
  startedAt: 0,
  deadline: 0,
  challenge: null,
  answered: false,
  correctTotal: 0,
  wrongTotal: 0,
  streak: 0,
  bestStreak: 0,
  turnResult: null
};

function showScreen(id) {
  screens.forEach((screenId) => {
    $(screenId).classList.toggle("hidden", screenId !== id);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDifferentColor(color) {
  const choices = COLORS.filter((item) => item !== color);
  return randomItem(choices);
}

function currentPlayer() {
  return state.players[state.currentIndex];
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showError(message) {
  $("setupError").textContent = message;
}

function startGame() {
  const names = $("playerNames").value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length < 2) {
    showError("Add at least 2 player names to start!");
    return;
  }

  if (names.length > 100) {
    showError("For this version, please use 100 players or fewer.");
    return;
  }

  if (names.some((name) => name.length > 30)) {
    showError("Keep each player name to 30 characters or fewer.");
    return;
  }

  const normalizedNames = names.map((name) => name.toLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    showError("Give each player a unique name so the scoreboard is clear.");
    return;
  }

  state.players = names.map((name) => ({
    name,
    score: 0,
    correct: 0,
    wrong: 0,
    timeouts: 0,
    streak: 0,
    bestStreak: 0
  }));

  state.roundsPerPlayer = Number($("roundCount").value);
  state.turnDuration = Number($("turnDuration").value);

  resetMatchProgress();
  showError("");
  showPassScreen();
}

function resetMatchProgress() {
  stopTimers();

  state.currentIndex = 0;
  state.roundForPlayer = 1;
  state.challenge = null;
  state.answered = false;
  state.correctTotal = 0;
  state.wrongTotal = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.turnResult = null;

  state.players.forEach((player) => {
    player.score = 0;
    player.correct = 0;
    player.wrong = 0;
    player.timeouts = 0;
    player.streak = 0;
    player.bestStreak = 0;
  });
}

function showPassScreen() {
  stopTimers();

  const player = currentPlayer();
  $("passAvatar").textContent = player.name.charAt(0).toUpperCase();
  $("passPlayerName").textContent = player.name;
  $("passRoundLabel").textContent =
    `ROUND ${state.roundForPlayer} OF ${state.roundsPerPlayer}`;

  showScreen("passScreen");
}

function startTurn() {
  state.answered = false;
  state.turnResult = null;

  const player = currentPlayer();
  $("gameAvatar").textContent = player.name.charAt(0).toUpperCase();
  $("gamePlayerName").textContent = player.name;
  $("gameRoundLabel").textContent =
    `ROUND ${state.roundForPlayer} / ${state.roundsPerPlayer}`;

  resetButtons();
  createChallenge();
  showScreen("gameScreen");
  beginTimer();
}

function resetButtons() {
  document.querySelectorAll(".panic-button").forEach((button) => {
    button.disabled = false;
    button.classList.remove("correct-pick", "wrong-pick");
  });

  $("timerArea");
  document.querySelector(".timer-area").classList.remove("urgent");
  $("timerBar").style.width = "100%";
  $("switchNotice").classList.add("hidden");
  $("freezeHint").classList.add("hidden");
  $("challengeCard").classList.remove("freeze-card");
}

function createChallenge() {
  const type = randomItem(["match", "avoid", "reverse", "switch", "freeze"]);
  const target = randomItem(COLORS);

  state.challenge = {
    type,
    target,
    initialTarget: target,
    changed: false
  };

  const challenge = state.challenge;

  $("challengeBadge").textContent = {
    match: "⚡ MATCH IT",
    avoid: "🚫 AVOID IT",
    reverse: "🔄 FOLLOW THE CYCLE",
    switch: "👀 STAY ALERT",
    freeze: "🧊 FREEZE CHALLENGE"
  }[type];

  $("challengeEmoji").textContent = {
    match: "🎯",
    avoid: "🙅",
    reverse: "🔄",
    switch: "⚡",
    freeze: "🧊"
  }[type];

  $("challengeDescription").textContent = {
    match: "Choose the exact colour named below.",
    avoid: "Choose ANY colour except the one named below.",
    reverse: "Follow the colour cycle shown in the instruction.",
    switch: "The target changes while the timer is running!",
    freeze: "Hands off! Do not touch any colour button."
  }[type];

  $("challengeTitle").textContent = {
    match: `Tap ${COLOR_NAMES[target]}!`,
    avoid: `Don't tap ${COLOR_NAMES[target]}!`,
    reverse: `After ${COLOR_NAMES[target]}...`,
    switch: `Tap ${COLOR_NAMES[target]}!`,
    freeze: "DON'T TOUCH!"
  }[type];

  if (type === "reverse") {
    const nextColor = COLORS[(COLORS.indexOf(target) + 1) % COLORS.length];
    challenge.correctColor = nextColor;
    $("challengeTitle").textContent =
      `${COLOR_NAMES[target]} → ${COLOR_NAMES[nextColor]}!`;
    $("challengeDescription").textContent =
      "The cycle is RED → BLUE → YELLOW → GREEN → RED. Tap the next colour.";
  }

  if (type === "freeze") {
    $("freezeHint").classList.remove("hidden");
    $("challengeDescription").textContent =
      "Let the timer reach zero without pressing anything.";
  }

  if (type === "switch") {
    $("switchNotice").classList.remove("hidden");
    $("switchNotice").textContent = "⚠️ The target will change during this turn!";
  }
}

function beginTimer() {
  stopTimers();

  state.startedAt = Date.now();
  state.deadline = state.startedAt + state.turnDuration * 1000;

  const totalMs = state.turnDuration * 1000;

  if (state.challenge.type === "switch") {
    const delay = Math.min(1500, Math.floor(totalMs * 0.45));

    state.switchTimeout = setTimeout(() => {
      if (state.answered || !state.challenge) return;

      const nextTarget = randomDifferentColor(state.challenge.target);
      state.challenge.target = nextTarget;
      state.challenge.changed = true;

      $("challengeTitle").textContent = `NOW TAP ${COLOR_NAMES[nextTarget]}!`;
      $("challengeEmoji").textContent = COLOR_EMOJI[nextTarget];
      $("switchNotice").textContent = "⚡ SWITCH! The new colour is active NOW!";
      $("challengeCard").classList.add("switch-flash");

      setTimeout(() => {
        $("challengeCard").classList.remove("switch-flash");
      }, 400);
    }, delay);
  }

  updateTimer();
  state.timerInterval = setInterval(updateTimer, 50);
}

function updateTimer() {
  if (state.answered) return;

  const remaining = Math.max(0, state.deadline - Date.now());
  const fraction = remaining / (state.turnDuration * 1000);

  $("timerBar").style.width = `${fraction * 100}%`;
  $("timerNumber").textContent = (remaining / 1000).toFixed(1);

  document.querySelector(".timer-area").classList.toggle("urgent", remaining <= 1800);

  if (remaining <= 0) {
    finishByTimeout();
  }
}

function stopTimers() {
  if (state.timerInterval !== null) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  if (state.switchTimeout !== null) {
    clearTimeout(state.switchTimeout);
    state.switchTimeout = null;
  }
}

function disableButtons() {
  document.querySelectorAll(".panic-button").forEach((button) => {
    button.disabled = true;
  });
}

function handleButtonPress(color, button) {
  if (state.answered) return;

  const challenge = state.challenge;

  if (challenge.type === "freeze") {
    button.classList.add("wrong-pick");
    finishTurn("wrong", "You touched a button during the freeze!");
    return;
  }

  let correct = false;

  if (challenge.type === "match" || challenge.type === "switch") {
    correct = color === challenge.target;
  } else if (challenge.type === "avoid") {
    correct = color !== challenge.target;
  } else if (challenge.type === "reverse") {
    correct = color === challenge.correctColor;
  }

  button.classList.add(correct ? "correct-pick" : "wrong-pick");

  if (correct) {
    finishTurn("correct", getSuccessMessage());
  } else {
    finishTurn("wrong", getFailureMessage(color));
  }
}

function getSuccessMessage() {
  const messages = [
    "Lightning-fast reflexes! ⚡",
    "Your brain is ON FIRE! 🔥",
    "Clean move. Zero panic! 😎",
    "You understood the assignment! 🎯",
    "Too quick for the chaos! 🚀"
  ];

  return randomItem(messages);
}

function getFailureMessage(color) {
  const messages = [
    `Oops! ${COLOR_NAMES[color]} wasn't the move. 😅`,
    "Panic got the better of you! 🫠",
    "The buttons won this round. 😂",
    "Slow down... actually, speed up! 🤣",
    "The rules got you this time! 🌀"
  ];

  return randomItem(messages);
}

function finishByTimeout() {
  if (state.answered) return;

  if (state.challenge.type === "freeze") {
    finishTurn("correct", "You stayed calm and survived! 🧊");
  } else {
    finishTurn("timeout", "Time's up! The panic won this one. ⏰");
  }
}

function finishTurn(outcome, message) {
  if (state.answered) return;

  state.answered = true;
  stopTimers();
  disableButtons();

  const player = currentPlayer();
  let points = 0;

  if (outcome === "correct") {
    points = 2;
    player.score += points;
    player.correct += 1;
    player.streak += 1;
    player.bestStreak = Math.max(player.bestStreak, player.streak);
    state.correctTotal += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else if (outcome === "wrong") {
    points = -1;
    player.score += points;
    player.wrong += 1;
    player.streak = 0;
    state.wrongTotal += 1;
    state.streak = 0;
  } else {
    player.timeouts += 1;
    player.streak = 0;
    state.streak = 0;
  }

  state.turnResult = { outcome, points, message };

  $("resultEmoji").textContent = {
    correct: "🎉",
    wrong: "💥",
    timeout: "⏰"
  }[outcome];

  $("resultBadge").textContent = {
    correct: "NICE REFLEXES!",
    wrong: "PANIC DETECTED!",
    timeout: "TIME'S UP!"
  }[outcome];

  $("resultTitle").textContent = {
    correct: "Nailed it!",
    wrong: "Not this time!",
    timeout: "Too slow!"
  }[outcome];

  $("resultMessage").textContent = message;
  $("turnPoints").textContent = points > 0 ? `+${points}` : String(points);
  $("totalScoreLabel").textContent = `Total score: ${player.score}`;
  $("correctCount").textContent = player.correct;
  $("wrongCount").textContent = player.wrong;
  $("bestStreak").textContent = player.bestStreak;

  $("nextTurnBtn").innerHTML = isLastTurn()
    ? 'SEE FINAL RESULTS <span>🏆</span>'
    : 'NEXT PLAYER <span>→</span>';

  showScreen("resultScreen");
}

function isLastTurn() {
  return (
    state.currentIndex === state.players.length - 1 &&
    state.roundForPlayer === state.roundsPerPlayer
  );
}

function nextTurn() {
  if (isLastTurn()) {
    showLeaderboard();
    return;
  }

  if (state.currentIndex < state.players.length - 1) {
    state.currentIndex += 1;
  } else {
    state.currentIndex = 0;
    state.roundForPlayer += 1;
  }

  showPassScreen();
}

function showLeaderboard() {
  stopTimers();

  const sorted = [...state.players].sort((a, b) =>
    b.score - a.score ||
    b.correct - a.correct ||
    a.wrong - b.wrong ||
    a.name.localeCompare(b.name)
  );

  const topScore = sorted[0].score;
  const tied = sorted.filter((player) => player.score === topScore);

  $("finalHeading").textContent =
    tied.length > 1 ? "It's a tie! 🤝" : `${sorted[0].name} wins!`;

  $("finalSubtitle").textContent =
    tied.length > 1
      ? "A shared crown! Those reflexes were evenly matched."
      : "The calmest brain in the room takes the crown.";

  const podium = $("podium");
  podium.innerHTML = "";

  const places = [
    { player: sorted[1], className: "second", medal: "🥈" },
    { player: sorted[0], className: "first", medal: "🥇" },
    { player: sorted[2], className: "third", medal: "🥉" }
  ];

  places.forEach(({ player, className, medal }) => {
    if (!player) return;

    const item = document.createElement("div");
    item.className = `podium-place ${className}`;
    item.innerHTML = `
      <div style="font-size:29px">${medal}</div>
      <div class="podium-name">${escapeHTML(player.name)}</div>
      <div class="podium-score">${player.score} pts</div>
      <div class="podium-block">${medal}</div>
    `;
    podium.appendChild(item);
  });

  const scoreList = $("finalScoreList");
  scoreList.innerHTML = "";

  sorted.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `
      <div class="score-rank">${index + 1}</div>
      <div class="score-name">
        ${escapeHTML(player.name)}
        <div class="score-detail">
          ${player.correct} correct · ${player.wrong} mistakes ·
          ${player.timeouts} timeouts · best streak ${player.bestStreak}
        </div>
      </div>
      <div class="score-total">${player.score}</div>
    `;
    scoreList.appendChild(row);
  });

  showScreen("leaderboardScreen");
}

function endGame() {
  const confirmed = window.confirm("End the game and show the current scores?");
  if (!confirmed) return;

  stopTimers();
  state.answered = true;
  showLeaderboard();
}

function playAgain() {
  resetMatchProgress();
  showPassScreen();
}

function newGame() {
  stopTimers();

  $("playerNames").value = state.players.map((player) => player.name).join("\n");
  showError("");
  showScreen("setupScreen");
}

$("startGameBtn").addEventListener("click", startGame);
$("readyBtn").addEventListener("click", startTurn);
$("nextTurnBtn").addEventListener("click", nextTurn);
$("quitBtn").addEventListener("click", endGame);
$("endFromPassBtn").addEventListener("click", endGame);
$("playAgainBtn").addEventListener("click", playAgain);
$("newGameBtn").addEventListener("click", newGame);

document.querySelectorAll(".panic-button").forEach((button) => {
  button.addEventListener("click", () => {
    handleButtonPress(button.dataset.color, button);
  });
});

// Prevent a browser refresh from being accidentally triggered by Enter
// while the user is playing. The game itself needs no form submission.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" &&
      !$("gameScreen").classList.contains("hidden")) {
    endGame();
  }
});
