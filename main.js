"use strict";

var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var voice = new SpeechSynthesisUtterance();
var DEFAULT_RATE = 2;

voice.rate = DEFAULT_RATE;

var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioCtx = new AudioContext();

// Audio globals
var fadeOut = audioCtx.createGain();
var timeout = null;
var audioTag = null;

var DELTA = 0.01;
var TONE_DELTA = 0.3;
var CANVAS_WIDTH = canvas.width;
var CANVAS_HEIGHT = canvas.height;

// Make dese controllable
var Y_MIN = -10;
var Y_MAX = 10;
var X_MIN = -10;
var X_MAX = 10;
var GRID_SIZE = 1;

var CURSOR_WIDTH = 15;

function translatePoint(x, y) {
    return {
        x: (x - X_MIN) / (X_MAX - X_MIN) * CANVAS_WIDTH,
        y: (1 - (y - Y_MIN) / (Y_MAX - Y_MIN)) * CANVAS_WIDTH
    };
}

var state = {
    cursorEnabled: true,
    cursorDelta: 0.25,

    // Find something on screen?
    cursorX: 0,

    isPlaying: false,

    volume: 0.2,
    speed: 1,

    currentQuestionIndex: 0,

    graphVisible: false
};

function setState(newState) {
    for (var key in newState) {
        if (newState.hasOwnProperty(key)) {
            state[key] = newState[key];
        }
    }

    draw();
}

var fns = [["f(x) = x", function (x) {
    return x;
}], ["f(x) = \frac{x^2}{10}", function (x) {
    return x * x / 10;
}], ["f(x) = x^3/12 - 31x/12 + 5/2", function (x) {
    return x * x * x / 12 - 31 * x / 12 + 5 / 2;
}], ["f(x) = |x|", function (x) {
    return Math.abs(x);
}], ["f(x) = 5*sin(x)", function (x) {
    return 5 * Math.sin(x);
}], ["f(x) = tan(x/2)", function (x) {
    return Math.tan(x / 2);
}]];

var questions = [{
    choices: [["y = \\frac{x^2}{10}", function (x) {
        return x * x / 10;
    }], ["y = 5x + 3"], ["y = 2x - 3"], ["y = x"]]
}, {
    choices: [["y = -\\frac{x^2}{15}", function (x) {
        return -x * x / 15;
    }], ["y = \\frac{x^2}{15}"], ["y = \\frac{x^2}{8} + 5"], ["y = 5x + 8"]]
}, {
    choices: [["y = x", function (x) {
        return x;
    }], ["y = -x"], ["y = x^2"], ["y = -x^2"]]
},

// Require the use of scrubbing!
{
    choices: [["y = \\frac{x}{2}", function (x) {
        return x / 2;
    }], ["y = x"], ["y = \\frac{x}{3}"], ["y = 2x"]]
}, {
    choices: [["y = \\frac{x^3 - 3x^2 -46x + 48}{40}", function (x) {
        return (x * x * x - 3 * x * x - 46 * x + 48) / 40;
    }], ["y = \\frac{2x^2 - 6x + 13}{14}"], ["y = \\frac{2}{x + 7}"], ["y = 5x+6"]]
}, {
    choices: [["y = \\frac{-x^3 + 21x + 20}{20}", function (x) {
        return (-x * x * x + 21 * x + 20) / 20;
    }], ["y = \\frac{x^3 - 21x + 20}{20}"], ["y = x^2 - 3x + 4"], ["y = x^3"]]
}, {
    choices: [["y = 5sin(x)", function (x) {
        return 5 * Math.sin(x);
    }], ["y = x^3"], ["y = tan(x)"], ["y = x^4"]]
},

// Requires scrubber!
{
    choices: [["y = 3sin(x)", function (x) {
        return 3 * Math.sin(x);
    }], ["y = sin(x)"], ["y = 5sin(x)"], ["y = 9sin(x)"]]
},

// Requires scrubber!
{
    choices: [["y = 5cos(x)", function (x) {
        return 5 * Math.cos(x);
    }], ["y = sin(x)"], ["y = 5sin(x)"], ["y = 9sin(x)"]]
}];

var buttonHandlers = [];

// Scramble ze questions!
questions.forEach(function (question) {
    var choices = question.choices.slice(1);
    var shuffled = _.shuffle(choices);

    var insertIndex = Math.floor(Math.random() * (choices.length + 1));
    choices.splice(insertIndex, 0, question.choices[0]);

    question.choices = choices;
    question.correctIndex = insertIndex;
});

function playCorrectSound() {
    if (!audioTag) {
        audioTag = new Audio("question-correct.ogg");
        // Why won't this work in safari?
        // audioTag.load()
    }
    audioTag.play();
}

function wireButtons() {
    for (var i = 1; i <= 4; i++) {
        var button = document.getElementById("choice-" + i);
        var question = questions[state.currentQuestionIndex];

        if (buttonHandlers[i - 1]) {
            button.removeEventListener("click", buttonHandlers[i - 1]);
        }

        var buildHandler = function buildHandler(i, question, button) {
            return function (e) {
                e.preventDefault();

                // Wow these are awful
                if (i - 1 === question.correctIndex) {
                    // You got it right!
                    playCorrectSound();

                    button.classList.add("success");
                    setTimeout(function () {
                        button.classList.remove("success");
                    }, 16);

                    setTimeout(function () {
                        var newIndex = state.currentQuestionIndex + 1;
                        setState({
                            currentQuestionIndex: newIndex % questions.length,
                            cursorX: 0
                        });
                    }, 600);
                } else {
                    // Not right yet

                    button.classList.add("error");
                    setTimeout(function () {
                        button.classList.remove("error");
                    }, 16);
                }
            };
        };

        var handler = buildHandler(i, question, button);

        buttonHandlers[i - 1] = handler;
        button.addEventListener("click", handler);
    }
}

function renderQuestion() {
    var question = questions[state.currentQuestionIndex];
    for (var i = 1; i <= 4; i++) {
        var button = document.getElementById("choice-" + i);
        var latex = question.choices[i - 1][0];

        katex.render(latex, button);

        var a11yText = document.createElement("div");
        a11yText.classList.add("sr-only");
        button.appendChild(a11yText);

        katexA11yRender(question.choices[i - 1][0], a11yText);
    }

    wireButtons();
}

function currentFn(x) {
    var question = questions[state.currentQuestionIndex];
    return question.choices[question.correctIndex][1](x);
}

function drawVerticalGrid() {
    for (var i = X_MIN; i <= X_MAX; i += GRID_SIZE) {
        ctx.beginPath();
        var a = translatePoint(i, Y_MIN);
        ctx.moveTo(a.x, a.y);
        var b = translatePoint(i, Y_MAX);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
}

function drawHorizontalGrid() {
    for (var i = Y_MIN; i <= Y_MAX; i += GRID_SIZE) {
        ctx.beginPath();
        var a = translatePoint(X_MIN, i);
        ctx.moveTo(a.x, a.y);
        var b = translatePoint(X_MAX, i);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
}

function drawXAxis() {
    ctx.save();
    ctx.lineWidth = 5;
    ctx.beginPath();
    var a = translatePoint(X_MIN, 0);
    ctx.moveTo(a.x, a.y);
    var b = translatePoint(X_MAX, 0);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
}

function drawYAxis() {
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 5;
    var a = translatePoint(0, Y_MIN);
    ctx.moveTo(a.x, a.y);
    var b = translatePoint(0, Y_MAX);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
}

function drawEquation() {
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#66b5ff";

    var init = translatePoint(X_MIN, currentFn(X_MIN));
    ctx.moveTo(init.x, init.y);

    for (var x = X_MIN; x <= X_MAX; x += DELTA) {
        var coord = translatePoint(x, currentFn(x));
        ctx.lineTo(coord.x, coord.y);
    }

    ctx.stroke();
    ctx.restore();
}

function drawCursor() {
    var cursorCenter = translatePoint(state.cursorX, currentFn(state.cursorX));

    ctx.save();
    ctx.fillStyle = "#06b5ff";
    ctx.beginPath();
    ctx.arc(cursorCenter.x, cursorCenter.y, CURSOR_WIDTH, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function duration() {
    return (X_MAX - X_MIN) / (state.speed * 8);
}

function yToFreq(y) {
    var KEYS = 88;

    // Map to a key
    var key = (y - Y_MIN) / (Y_MAX - Y_MIN) * KEYS + 1;

    if (key > KEYS) {
        return 0;
    } else {
        return Math.pow(2, (key - 49) / 12) * 440;
    }
}

function stopSound() {
    // Fade out the sound
    fadeOut.gain.setTargetAtTime(0, audioCtx.currentTime + 0.1, 0.01);
    // Clear the timeout so we don't accidentally claim we're not playing
    clearTimeout(timeout);
}

function playGraph() {
    if (state.isPlaying) {
        stopSound();
    }

    setState({ isPlaying: true });

    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    gain.gain.value = state.volume;

    // Fade out
    fadeOut = audioCtx.createGain();
    fadeOut.gain.setTargetAtTime(0, audioCtx.currentTime + duration() - 0.1, 0.01);

    for (var x = X_MIN; x <= X_MAX; x += TONE_DELTA) {
        var time = (x - X_MIN) / (X_MAX - X_MIN) * duration();

        osc.frequency.setValueAtTime(yToFreq(currentFn(x)), audioCtx.currentTime + time);
    }

    osc.connect(gain);
    gain.connect(fadeOut);
    fadeOut.connect(audioCtx.destination);

    // Play the source
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration());

    // Change the state that we're not playing anymore
    timeout = setTimeout(function () {
        setState({ isPlaying: false });
    }, duration() * 1000);
}

function playSound(x) {
    if (state.isPlaying) {
        stopSound();
    }

    var duration = 0.1;

    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    gain.gain.value = state.volume;

    fadeOut = audioCtx.createGain();
    fadeOut.gain.setTargetAtTime(0, audioCtx.currentTime + duration / 2, 0.02);

    osc.frequency.value = yToFreq(currentFn(x));

    osc.connect(gain);
    gain.connect(fadeOut);
    fadeOut.connect(audioCtx.destination);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

function announceCoords(slow) {
    if (slow) {
        voice.rate = 1;
    }

    speechSynthesis.cancel();
    voice.text = round(state.cursorX) + "; " + round(currentFn(state.cursorX));
    speechSynthesis.speak(voice);
    voice.rate = DEFAULT_RATE;
}

document.addEventListener("keydown", function (e) {
    if (e.keyCode >= 49 && e.keyCode <= 57) {
        setState({ currentQuestionIndex: e.keyCode - 49 });
    }

    // P
    if (e.keyCode === 80) {
        playGraph();
    }

    // Left
    if (e.keyCode === 37) {
        var newCursorX = state.cursorX - state.cursorDelta;
        setState({ cursorX: newCursorX });
        playSound(newCursorX);
        announceCoords();
    }

    // Right
    if (e.keyCode === 39) {
        var newCursorX = state.cursorX + state.cursorDelta;
        setState({ cursorX: newCursorX });
        playSound(newCursorX);
        announceCoords();
    }

    // A
    if (e.keyCode === 65) {
        announceCoords(true /* slow */);
    }

    // S
    if (e.keyCode === 83) {
        playSound(state.cursorX);
    }

    if (e.keyCode === 84) {
        setState({
            graphVisible: !state.graphVisible
        });
    }

    // W
    if (e.keyCode === 87) {
        setState({
            speed: state.speed * 2
        });
        playGraph();
    }

    // Q
    if (e.keyCode === 81) {
        setState({
            speed: state.speed / 2
        });
        playGraph();
    }
});

function round(v) {
    return Math.round(v * 1000) / 1000;
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawHorizontalGrid();
    drawVerticalGrid();
    drawXAxis();
    drawYAxis();
    drawEquation();
    drawCursor();

    document.getElementById("question").innerText = state.currentQuestionIndex + 1;

    renderQuestion();

    if (state.graphVisible) {
        document.getElementById("canvas").classList.remove("hidden");
    } else {
        document.getElementById("canvas").classList.add("hidden");
    }
}

draw();

