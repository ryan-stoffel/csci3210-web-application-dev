import { WORDS } from "./words.js";

const NUMBER_OF_GUESSES = 6;
const THEMES = {
    classic: WORDS,
    food: ["apple", "bread", "grape", "lemon", "peach", "onion", "melon", "mango", "olive", "pasta", "pizza", "sugar", "cream", "honey"],
    tech: ["array", "cache", "cloud", "debug", "input", "logic", "queue", "stack", "bytes", "mouse", "pixel", "proxy"],
};
const STATS_KEY = "hw2-wordle-stats";
let rightGuessString;
let guessesRemaining = NUMBER_OF_GUESSES;
let currentGuess = [];
let revealing = false;
let hintUsed = false;
let stats = { played: 0, wins: 0, streak: 0, bestStreak: 0, totalGuesses: 0 };
try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY));
    if (saved && Object.keys(stats).every(key => Number.isSafeInteger(saved[key]) && saved[key] >= 0)
        && saved.wins <= saved.played && saved.streak <= saved.bestStreak && saved.bestStreak <= saved.wins
        && saved.totalGuesses >= saved.wins && saved.totalGuesses <= saved.wins * NUMBER_OF_GUESSES) {
        stats = saved;
    }
} catch {
    // Corrupt or unavailable browser storage falls back to session statistics.
}

function renderStats() {
    const winRate = stats.played === 0 ? 0 : Math.round(100 * stats.wins / stats.played);
    const average = stats.wins === 0 ? "—" : (stats.totalGuesses / stats.wins).toFixed(1);
    document.getElementById("statistics").textContent = `Played: ${stats.played} · Wins: ${stats.wins} · Losses: ${stats.played - stats.wins} · Win rate: ${winRate}% · Streak: ${stats.streak} · Best: ${stats.bestStreak} · Avg. winning guesses: ${average}`;
}

function recordResult(won) {
    stats.played += 1;
    if (won) {
        stats.wins += 1;
        stats.totalGuesses += NUMBER_OF_GUESSES - guessesRemaining;
        stats.streak += 1;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else {
        stats.streak = 0;
    }
    try {
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
        // A denied/full storage area must not interrupt the game.
    }
    renderStats();
}

function updateControls() {
    document.getElementById("new-game").disabled = revealing;
    document.getElementById("word-theme").disabled = revealing;
    document.getElementById("hint").disabled = revealing || hintUsed || guessesRemaining === 0;
}

function startGame() {
    if (revealing) return;
    const theme = document.getElementById("word-theme").value;
    const pool = THEMES[theme];
    rightGuessString = pool[Math.floor(Math.random() * pool.length)];
    document.body.dataset.theme = theme;
    guessesRemaining = NUMBER_OF_GUESSES;
    currentGuess = [];
    hintUsed = false;
    document.getElementById("game-board").replaceChildren();
    initBoard();
    for (const button of document.getElementsByClassName("keyboard-button")) {
        button.style.backgroundColor = "";
        button.style.color = "";
    }
    toastr.remove();
    document.getElementById("game-status").textContent = "6 guesses remaining.";
    document.getElementById("hint-status").textContent = "One free letter hint per game.";
    updateControls();
}

function revealHint() {
    if (revealing || hintUsed || guessesRemaining === 0) return;
    const rows = [...document.getElementsByClassName("letter-row")];
    const position = [...rightGuessString].findIndex((letter, index) =>
        rows.every(row => row.children[index].style.backgroundColor !== "green"));
    hintUsed = true;
    const letter = rightGuessString[position];
    document.getElementById("hint-status").textContent = `Hint: letter ${position + 1} is ${letter.toUpperCase()}.`;
    shadeKeyBoard(letter, "green");
    updateControls();
}

function initBoard() {
    const board = document.getElementById("game-board");
    for (let i = 0; i < NUMBER_OF_GUESSES; i++) {
        const row = document.createElement("div");
        row.className = "letter-row";
        row.setAttribute("role", "group");
        row.setAttribute("aria-label", `Guess ${i + 1}`);
        for (let j = 0; j < 5; j++) {
            const box = document.createElement("div");
            box.className = "letter-box";
            box.setAttribute("aria-label", `Letter ${j + 1}: empty`);
            row.appendChild(box);
        }
        board.appendChild(row);
    }
}

function animateCSS(node, animation) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    node.classList.remove("animate__animated", "animate__pulse", "animate__flipInX");
    void node.offsetWidth; // Restart an animation if this tile is still pulsing.
    node.style.setProperty("--animate-duration", "0.3s");
    node.classList.add("animate__animated", `animate__${animation}`);
    node.onanimationend = () => {
        node.classList.remove("animate__animated", `animate__${animation}`);
    };
}

// Both keyboards use the same input rules, including the reveal/game-over lock.
function handleInput(key) {
    if (guessesRemaining === 0 || revealing) return;
    if (key === "Backspace") {
        if (currentGuess.length > 0) deleteLetter();
    } else if (key === "Enter") {
        checkGuess();
    } else if (/^[a-z]$/i.test(key)) {
        insertLetter(key.toLowerCase());
    }
}

function insertLetter(letter) {
    if (currentGuess.length === 5) return;
    const row = document.getElementsByClassName("letter-row")[NUMBER_OF_GUESSES - guessesRemaining];
    const box = row.children[currentGuess.length];
    animateCSS(box, "pulse");
    box.textContent = letter;
    box.classList.add("filled-box");
    box.setAttribute("aria-label", `Letter ${currentGuess.length + 1}: ${letter.toUpperCase()}`);
    currentGuess.push(letter);
}

function deleteLetter() {
    const row = document.getElementsByClassName("letter-row")[NUMBER_OF_GUESSES - guessesRemaining];
    const box = row.children[currentGuess.length - 1];
    box.textContent = "";
    box.classList.remove("filled-box");
    box.setAttribute("aria-label", `Letter ${currentGuess.length}: empty`);
    currentGuess.pop();
}

function checkGuess() {
    const guessString = currentGuess.join("");
    if (guessString.length !== 5) {
        toastr.error("Not enough letters!");
        return;
    }
    if (!WORDS.includes(guessString)) {
        toastr.error("Word not in list!");
        return;
    }

    const row = document.getElementsByClassName("letter-row")[NUMBER_OF_GUESSES - guessesRemaining];
    const remainingLetters = Array.from(rightGuessString);
    const colors = Array(5).fill("grey");
    // Reserve exact matches first so duplicate letters cannot steal their colors.
    for (let i = 0; i < 5; i++) {
        if (guessString[i] === rightGuessString[i]) {
            colors[i] = "green";
            remainingLetters[i] = null;
        }
    }
    for (let i = 0; i < 5; i++) {
        if (colors[i] === "green") continue;
        const position = remainingLetters.indexOf(guessString[i]);
        if (position !== -1) {
            colors[i] = "yellow";
            remainingLetters[position] = null;
        }
    }

    revealing = true;
    updateControls();
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            const box = row.children[i];
            animateCSS(box, "flipInX");
            box.style.backgroundColor = colors[i];
            box.style.color = colors[i] === "yellow" ? "black" : "white";
            const meaning = { green: "correct position", yellow: "wrong position", grey: "not in word" };
            box.setAttribute("aria-label", `${guessString[i].toUpperCase()}: ${meaning[colors[i]]}`);
            shadeKeyBoard(guessString[i], colors[i]);
        }, 250 * i);
    }
    setTimeout(() => {
        guessesRemaining -= 1;
        currentGuess = [];
        revealing = false;
        const status = document.getElementById("game-status");
        if (guessString === rightGuessString) {
            recordResult(true);
            guessesRemaining = 0;
            status.textContent = "You guessed right! Game over! Select New game to play again.";
            toastr.success("You guessed right! Game over!");
        } else if (guessesRemaining === 0) {
            recordResult(false);
            status.textContent = `Game over! The right word was: ${rightGuessString.toUpperCase()}. Select New game to play again.`;
            toastr.error("You've run out of guesses! Game over!");
            toastr.info(`The right word was: "${rightGuessString}"`);
        } else {
            status.textContent = `${guessesRemaining} guesses remaining.`;
        }
        updateControls();
    }, 1300);
}

function shadeKeyBoard(letter, color) {
    for (const button of document.getElementsByClassName("keyboard-button")) {
        if (button.textContent !== letter) continue;
        const oldColor = button.style.backgroundColor;
        if (oldColor === "green" || (oldColor === "yellow" && color !== "green")) return;
        button.style.backgroundColor = color;
        button.style.color = color === "yellow" ? "black" : "white";
        return;
    }
}

document.addEventListener("keyup", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    // A focused button already generates its own click when Enter is pressed.
    if (event.target instanceof HTMLSelectElement) return;
    if (event.key === "Enter" && event.target instanceof HTMLButtonElement) return;
    handleInput(event.key);
});

document.getElementById("keyboard-cont").addEventListener("click", (event) => {
    const button = event.target.closest(".keyboard-button");
    if (!button) return;
    handleInput(button.textContent === "Del" ? "Backspace" : button.textContent);
});

document.getElementById("new-game").addEventListener("click", startGame);
document.getElementById("word-theme").addEventListener("change", startGame);
document.getElementById("hint").addEventListener("click", revealHint);

renderStats();
startGame();
