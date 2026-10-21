
"use strict";

// ==========================================
// PANIC BUTTON — SINGLE + MULTIPLAYER
// ==========================================

const $ = (id) => document.getElementById(id);

const screens = [
  "modeScreen",
  "setupScreen",
  "passScreen",
  "gameScreen",
  "resultScreen",
  "leaderboardScreen"
];

const COLORS = ["RED", "BLUE", "YELLOW", "GREEN"];

const COLOR_EMOJI = {
  RED: "🔴",
  BLUE: "🔵",
  YELLOW: "🟡",
  GREEN: "🟢"
};

const CHALLENGES = [
  {
    type: "match",
    emoji: "🎯",
    title: "MATCH THE COLOUR",
    badge: "QUICK REACTION",
    description: "Tap the colour shown on the screen!",
    create() {
      const target = randomColor();
      return {
        target,
        description: `Tap ${target}!`,
        answer: target
      };
    }
  },
  {
    type: "avoid",
    emoji: "🙅",
    title: "AVOID THAT COLOUR",
    badge: "DON'T GET TRICKED",
    description: "Tap any colour except the target!",
    create() {
      const target = randomColor();
      return {
        target,
        description: `Whatever you do, DON'T tap ${target}!`,
        answer: null
      };
    }
  },
  {
    type: "reverse",
    emoji: "🔄",
    title: "REVERSE RULE",
    badge: "THINK FAST",
    description: "Follow the colour cycle!",
    create() {
      const previous = randomColor();
      const index = COLORS.indexOf(previous);
      const answer = COLORS[(index + 1) % COLORS.length];

      return {
        target: previous,
        description: `After ${previous} comes the NEXT colour. Tap it!`,
        answer
      };
    }
  },
  {
    type: "switch",
    emoji: "🌀",
    title: "COLOUR SWITCH!",
    badge: "STAY ALERT",
    description: "The target might change!",
    create() {
      const target = randomColor();
      let nextTarget = randomColor();

      while (nextTarget === target) {
        nextTarget = randomColor();
      }

      return {
        target,
        nextTarget,
        description: `Tap ${target}! Watch out — the target can switch!`,
        answer: target
      };
    }
  },
  {
    type: "freeze",
    emoji: "🧊",
    title: "FREEZE!",
    badge: "HANDS OFF",
    description: "Do not touch any button until time runs out!",
    create() {
      return {
        target: null,
        description: "DON'T TAP ANYTHING! Wait until the timer ends.",
        answer: null
      };
    }
  }
];

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// ==========================================
// GAME STATE
// ==========================================

let gameMode = null;
let players = [];
let currentPlayerIndex = 0;
let currentRound = 1;
let totalRounds = 3;
let turnDuration = 5;

let challenge = null;
let timerInterval = null;
let switchTimeout = null;
let turnStartTime = 0;
let timeLeft = 0;
let turnFinished = false;

let turnScore = 0;
let turnResult = "";
let bestStreak = 0;
let currentStreak = 0;
let correctCount = 0;
let wrongCount = 0;
let timeoutCount = 0;
let turnHistory = [];

// ==========================================
// SCREEN MANAGEMENT
// ==========================================

function showScreen(screenId) {
  screens.forEach((id) => {
    const screen = $(id);
    if (screen) screen.classList.add("hidden");
  });

  const target = $(screenId);
  if (target) target.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ==========================================
// MODE SELECTION
// ==========================================

function initModeSelection() {
  const modeCards = document.querySelectorAll("[data-mode]");
  const continueButton = $("continueModeBtn");

  modeCards.forEach((card) => {
    card.addEventListener("click", () => {
      gameMode = card.dataset.mode;

      modeCards.forEach((item) => {
        item.classList.toggle("selected", item === card);
      });

      if (continueButton) {
        continueButton.disabled = false;
        continueButton.textContent =
          gameMode === "single"
            ? "Continue to Solo Setup →"
            : "Continue to Multiplayer Setup →";
      }
    });
  });

  if (continueButton) {
    continueButton.addEventListener("click", () => {
      if (!gameMode) return;

      if (gameMode === "single") {
        // Solo mode uses one player.
        if ($("playerNames")) {
          $("playerNames").value = "Player 1";
        }

        showScreen("setupScreen");
      } else {
        if ($("playerNames") && !$("playerNames").value.trim()) {
          $("playerNames").value =
            "Player 1\nPlayer 2\nPlayer 3\nPlayer 4";
        }

        showScreen("setupScreen");
      }

      updateModeSetup();
    });
  }
}

function updateModeSetup() {
  const heading = $("setupScreen")?.querySelector("h1");
  const nameInput = $("playerNames");
  const nameField = nameInput?.closest(".form-group, .input-group");

  if (gameMode === "single") {
    if (heading) heading.textContent = "Solo Panic Challenge!";

    if (nameInput) {
      nameInput.value = "Player 1";
      nameInput.disabled = true;
    }

    if (nameField) nameField.style.display = "none";
  } else {
    if (heading) heading.textContent = "Set Up Your Players!";

    if (nameInput) {
      nameInput.disabled = false;
      if (nameInput.value.trim() === "Player 1") {
        nameInput.value =
          "Player 1\nPlayer 2\nPlayer 3\nPlayer 4";
      }
    }

    if (nameField) nameField.style.display = "";
  }
}

// ==========================================
// PLAYER SETUP
// ==========================================

function startGame() {
  const namesText = $("playerNames")?.value || "";
  const names = namesText
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);

  if (gameMode === "single") {
    names.length = 0;
    names.push("Player 1");
  }

  if (names.length < 1 || (gameMode === "multi" && names.length < 2)) {
    if ($("setupError")) {
      $("setupError").textContent =
        "Multiplayer needs at least 2 players!";
      $("setupError").classList.remove("hidden");
    }
    return;
  }

  if (names.length > 100) {
    if ($("setupError")) {
      $("setupError").textContent = "Maximum 100 players allowed.";
      $("setupError").classList.remove("hidden");
    }
    return;
  }

  if (names.some((name) => name.length > 30)) {
    if ($("setupError")) {
      $("setupError").textContent =
        "Player names must be 30 characters or fewer.";
      $("setupError").classList.remove("hidden");
    }
    return;
  }

  const uniqueNames = names.map((name) => name.toLowerCase());

  if (new Set(uniqueNames).size !== uniqueNames.length) {
    if ($("setupError")) {
      $("setupError").textContent =
        "Please use different names for every player.";
      $("setupError").classList.remove("hidden");
    }
    return;
  }

  if ($("setupError")) $("setupError").classList.add("hidden");

  totalRounds = Number($("roundCount")?.value || 3);
  turnDuration = Number($("turnDuration")?.value || 5);

  players = names.map((name) => ({
    name,
    score: 0,
    correct: 0,
    wrong: 0,
    timeouts: 0,
    bestStreak: 0,
    streak: 0
  }));

  currentPlayerIndex = 0;
  currentRound = 1;
  turnHistory = [];

  showPassScreen();
}

// ==========================================
// PASS PHONE / START TURN
// ==========================================

function showPassScreen() {
  if (gameMode === "single") {
    startTurn();
    return;
  }

  const player = players[currentPlayerIndex];

  if ($("passAvatar")) {
    $("passAvatar").textContent = "🎮";
  }

  if ($("passPlayerName")) {
    $("passPlayerName").textContent = player.name;
  }

  if ($("passRoundLabel")) {
    $("passRoundLabel").textContent =
      `Round ${currentRound} of ${totalRounds}`;
  }

  showScreen("passScreen");
}

function startTurn() {
  clearTimers();

  const player = players[currentPlayerIndex];

  if ($("gameAvatar")) $("gameAvatar").textContent = "🚨";
  if ($("gamePlayerName")) {
    $("gamePlayerName").textContent = player.name;
  }

  if ($("gameRoundLabel")) {
    $("gameRoundLabel").textContent =
      gameMode === "single"
        ? `Solo Round ${currentRound} of ${totalRounds}`
        : `Round ${currentRound} of ${totalRounds}`;
  }

  turnScore = 0;
  turnFinished = false;
  turnResult = "";
  timeLeft = turnDuration;

  challenge = createChallenge();

  resetButtons();
  renderChallenge();

  showScreen("gameScreen");
  beginTimer();
}

function createChallenge() {
  const chosen = CHALLENGES[
    Math.floor(Math.random() * CHALLENGES.length)
  ];

  return {
    ...chosen,
    ...chosen.create()
  };
}

// ==========================================
// CHALLENGE DISPLAY
// ==========================================

function renderChallenge() {
  if (!challenge) return;

  if ($("challengeBadge")) {
    $("challengeBadge").textContent = challenge.badge;
  }

  if ($("challengeEmoji")) {
    $("challengeEmoji").textContent = challenge.emoji;
  }

  if ($("challengeTitle")) {
    $("challengeTitle").textContent = challenge.title;
  }

  if ($("challengeDescription")) {
    $("challengeDescription").textContent = challenge.description;
  }

  const grid = $("buttonGrid");

  if (grid) {
    grid.querySelectorAll("[data-color]").forEach((button) => {
      button.disabled = false;
      button.classList.remove("correct", "wrong", "target-color");
      button.textContent = button.dataset.color;
      button.style.opacity = "1";
    });
  }

  updateTargetHighlight();
}

function updateTargetHighlight() {
  const grid = $("buttonGrid");
  if (!grid) return;

  grid.querySelectorAll("[data-color]").forEach((button) => {
    button.classList.toggle(
      "target-color",
      button.dataset.color === challenge?.target
    );
  });
}

function resetButtons() {
  const grid = $("buttonGrid");
  if (!grid) return;

  grid.querySelectorAll("[data-color]").forEach((button) => {
    button.disabled = false;
    button.classList.remove("correct", "wrong", "target-color");
    button.style.opacity = "1";
  });

  if ($("freezeHint")) {
    $("freezeHint").classList.toggle(
      "hidden",
      challenge?.type !== "freeze"
    );
  }
}

// ==========================================
// TIMER
// ==========================================

function beginTimer() {
  turnStartTime = Date.now();
  timeLeft = turnDuration;
  updateTimer();

  timerInterval = setInterval(() => {
    if (turnFinished) return;

    const elapsed = (Date.now() - turnStartTime) / 1000;
    timeLeft = Math.max(0, turnDuration - elapsed);

    updateTimer();

    if (
      challenge.type === "switch" &&
      !challenge.switched &&
      elapsed >= Math.min(1.5, turnDuration * 0.45)
    ) {
      switchTarget();
    }

    if (timeLeft <= 0) {
      finishByTimeout();
    }
  }, 50);
}

function updateTimer() {
  const seconds = Math.max(0, timeLeft);

  if ($("timerNumber")) {
    $("timerNumber").textContent = seconds.toFixed(1);
  }

  const bar = $("timerBar");
  if (bar) {
    const percent = Math.max(0, (seconds / turnDuration) * 100);

    bar.style.width = `${percent}%`;

    const timerArea = bar.closest(".timer-area");
    if (timerArea) {
      timerArea.classList.toggle("urgent", seconds <= 2);
    }
  }
}

function switchTarget() {
  if (turnFinished || challenge.type !== "switch") return;

  challenge.switched = true;
  challenge.target = challenge.nextTarget;
  challenge.answer = challenge.nextTarget;

  if ($("challengeDescription")) {
    $("challengeDescription").textContent =
      `SWITCH! Now tap ${challenge.target}!`;
  }

  updateTargetHighlight();

  if ($("switchNotice")) {
    $("switchNotice").classList.remove("hidden");
    $("switchNotice").classList.add("switch-flash");
  }
}

function clearTimers() {
  if (timerInterval) clearInterval(timerInterval);
  if (switchTimeout) clearTimeout(switchTimeout);

  timerInterval = null;
  switchTimeout = null;
}

// ==========================================
// BUTTON PRESS / SCORING
// ==========================================

function handleButtonPress(color) {
  if (turnFinished || !challenge) return;

  const button = document.querySelector(
    `[data-color="${color}"]`
  );

  if (challenge.type === "freeze") {
    if (button) button.classList.add("wrong");

    turnScore = -1;
    wrongCount++;
    players[currentPlayerIndex].wrong++;
    players[currentPlayerIndex].streak = 0;

    finishTurn(
      "wrong",
      "You panicked!",
      "You tapped during Freeze. That's a -1 penalty!"
    );

    return;
  }

  let isCorrect = false;

  if (challenge.type === "match") {
    isCorrect = color === challenge.target;
  } else if (challenge.type === "avoid") {
    isCorrect = color !== challenge.target;
  } else if (challenge.type === "reverse") {
    isCorrect = color === challenge.answer;
  } else if (challenge.type === "switch") {
    isCorrect = color === challenge.target;
  }

  if (isCorrect) {
    turnScore = 2;
    correctCount++;

    const player = players[currentPlayerIndex];
    player.correct++;
    player.streak++;
    player.bestStreak = Math.max(
      player.bestStreak,
      player.streak
    );

    currentStreak++;
    bestStreak = Math.max(bestStreak, currentStreak);

    if (button) button.classList.add("correct");

    finishTurn(
      "correct",
      "Nailed it!",
      "Quick reflexes! You earned +2 points."
    );
  } else {
    turnScore = -1;
    wrongCount++;

    const player = players[currentPlayerIndex];
    player.wrong++;
    player.streak = 0;
    currentStreak = 0;

    if (button) button.classList.add("wrong");

    finishTurn(
      "wrong",
      "Oops! Wrong button!",
      "The panic got you. You lost 1 point."
    );
  }
}

function finishByTimeout() {
  if (turnFinished) return;

  if (challenge?.type === "freeze") {
    turnScore = 2;
    correctCount++;

    const player = players[currentPlayerIndex];
    player.correct++;
    player.streak++;
    player.bestStreak = Math.max(
      player.bestStreak,
      player.streak
    );

    finishTurn(
      "correct",
      "Ice cold!",
      "You stayed frozen! +2 points."
    );
  } else {
    turnScore = 0;
    timeoutCount++;

    players[currentPlayerIndex].timeouts++;
    players[currentPlayerIndex].streak = 0;
    currentStreak = 0;

    finishTurn(
      "timeout",
      "Time's up!",
      "You ran out of time. No points this turn."
    );
  }
}

function finishTurn(status, title, message) {
  if (turnFinished) return;

  turnFinished = true;
  clearTimers();

  const player = players[currentPlayerIndex];
  player.score += turnScore;

  turnHistory.push({
    player: player.name,
    round: currentRound,
    score: turnScore,
    status,
    challenge: challenge.title
  });

  if ($("resultEmoji")) {
    $("resultEmoji").textContent =
      status === "correct" ? "🎉" :
      status === "wrong" ? "😵" : "⏰";
  }

  if ($("resultBadge")) {
    $("resultBadge").textContent =
      status === "correct" ? "SUCCESS" :
      status === "wrong" ? "PANIC MOMENT" : "TIME OUT";
  }

  if ($("resultTitle")) $("resultTitle").textContent = title;
  if ($("resultMessage")) $("resultMessage").textContent = message;

  if ($("turnPoints")) {
    $("turnPoints").textContent =
      turnScore > 0 ? `+${turnScore}` : `${turnScore}`;
  }

  if ($("totalScoreLabel")) {
    $("totalScoreLabel").textContent =
      `Total score: ${player.score}`;
  }

  if ($("correctCount")) {
    $("correctCount").textContent = player.correct;
  }

  if ($("wrongCount")) {
    $("wrongCount").textContent = player.wrong;
  }

  if ($("bestStreak")) {
    $("bestStreak").textContent = player.bestStreak;
  }

  showScreen("resultScreen");

  const nextButton = $("nextTurnBtn");
  if (nextButton) {
    nextButton.textContent =
      gameMode === "single"
        ? currentRound >= totalRounds
          ? "See My Results 🏆"
          : "Next Challenge →"
        : currentRound >= totalRounds &&
          currentPlayerIndex >= players.length - 1
          ? "See Leaderboard 🏆"
          : "Next Turn →";
  }
}

// ==========================================
// NEXT TURN / ROUND
// ==========================================

function nextTurn() {
  if (gameMode === "single") {
    if (currentRound >= totalRounds) {
      showLeaderboard();
    } else {
      currentRound++;
      startTurn();
    }
    return;
  }

  if (currentPlayerIndex < players.length - 1) {
    currentPlayerIndex++;
  } else {
    currentPlayerIndex = 0;
    currentRound++;
  }

  if (currentRound > totalRounds) {
    showLeaderboard();
  } else {
    showPassScreen();
  }
}

// ==========================================
// FINAL RESULTS / LEADERBOARD
// ==========================================

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showLeaderboard() {
  clearTimers();

  const ranked = [...players].sort((a, b) => b.score - a.score);

  if (gameMode === "single") {
    if ($("finalHeading")) {
      $("finalHeading").textContent = "Solo Results!";
    }

    if ($("finalSubtitle")) {
      $("finalSubtitle").textContent =
        `You scored ${ranked[0].score} points!`;
    }
  } else {
    if ($("finalHeading")) {
      $("finalHeading").textContent = "Panic Button Champions!";
    }

    if ($("finalSubtitle")) {
      const winners = ranked.filter(
        (player) => player.score === ranked[0].score
      );

      $("finalSubtitle").textContent =
        winners.length > 1
          ? `It's a tie between ${winners.map((p) => p.name).join(" and ")}!`
          : `${ranked[0].name} is the Panic Button champion!`;
    }
  }

  const podium = $("podium");

  if (podium) {
    if (gameMode === "single") {
      podium.innerHTML = `
        <div class="podium-place first">
          <div class="podium-medal">🏆</div>
          <div class="podium-name">${escapeHTML(ranked[0].name)}</div>
          <div class="podium-score">${ranked[0].score} points</div>
        </div>
      `;
    } else {
      podium.innerHTML = ranked.slice(0, 3).map((player, index) => `
        <div class="podium-place ${["first", "second", "third"][index]}">
          <div class="podium-medal">${["🥇", "🥈", "🥉"][index]}</div>
          <div class="podium-name">${escapeHTML(player.name)}</div>
          <div class="podium-score">${player.score} pts</div>
        </div>
      `).join("");
    }
  }

  const scoreList = $("finalScoreList");

  if (scoreList) {
    scoreList.innerHTML = ranked.map((player, index) => `
      <div class="score-row">
        <span class="score-rank">#${index + 1}</span>
        <span class="score-player">${escapeHTML(player.name)}</span>
        <span class="score-points">${player.score} pts</span>
        <span class="score-stats">
          ✅ ${player.correct} · ❌ ${player.wrong} · ⏰ ${player.timeouts}
        </span>
      </div>
    `).join("");
  }

  showScreen("leaderboardScreen");
}

// ==========================================
// REPLAY / NEW GAME / QUIT
// ==========================================

function playAgain() {
  clearTimers();

  players.forEach((player) => {
    player.score = 0;
    player.correct = 0;
    player.wrong = 0;
    player.timeouts = 0;
    player.bestStreak = 0;
    player.streak = 0;
  });

  currentPlayerIndex = 0;
  currentRound = 1;
  turnHistory = [];
  currentStreak = 0;
  bestStreak = 0;

  if (gameMode === "single") {
    startTurn();
  } else {
    showPassScreen();
  }
}

function newGame() {
  clearTimers();

  gameMode = null;
  players = [];
  currentPlayerIndex = 0;
  currentRound = 1;
  turnHistory = [];
  currentStreak = 0;
  bestStreak = 0;

  const modeCards = document.querySelectorAll("[data-mode]");
  modeCards.forEach((card) => card.classList.remove("selected"));

  const continueButton = $("continueModeBtn");
  if (continueButton) {
    continueButton.disabled = true;
    continueButton.textContent = "Choose a mode first →";
  }

  const nameInput = $("playerNames");
  if (nameInput) {
    nameInput.disabled = false;
    nameInput.value = "Player 1\nPlayer 2\nPlayer 3\nPlayer 4";
  }

  const nameField = nameInput?.closest(".form-group, .input-group");
  if (nameField) nameField.style.display = "";

  showScreen("modeScreen");
}

function endGame() {
  if (confirm("End this game and view the final results?")) {
    showLeaderboard();
  }
}

// ==========================================
// BUTTON EVENTS
// ==========================================

function initGame() {
  initModeSelection();

  $("startGameBtn")?.addEventListener("click", startGame);
  $("readyBtn")?.addEventListener("click", startTurn);
  $("nextTurnBtn")?.addEventListener("click", nextTurn);
  $("playAgainBtn")?.addEventListener("click", playAgain);
  $("newGameBtn")?.addEventListener("click", newGame);
  $("quitBtn")?.addEventListener("click", endGame);
  $("endFromPassBtn")?.addEventListener("click", endGame);

  const grid = $("buttonGrid");

  if (grid) {
    grid.querySelectorAll("[data-color]").forEach((button) => {
      button.addEventListener("click", () => {
        handleButtonPress(button.dataset.color);
      });
    });
  }

  showScreen("modeScreen");
}

document.addEventListener("DOMContentLoaded", initGame);
