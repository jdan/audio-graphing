"use strict"

const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")
const voice = new SpeechSynthesisUtterance()
const DEFAULT_RATE = 2

voice.rate = DEFAULT_RATE

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
let osc = audioCtx.createOscillator();
let timeout = null;

const DELTA = 0.01
const TONE_DELTA = 0.3
const CANVAS_WIDTH = canvas.width
const CANVAS_HEIGHT = canvas.height

// Make dese controllable
const Y_MIN = -10
const Y_MAX = 10
const X_MIN = -10
const X_MAX = 10
const GRID_SIZE = 1

const CURSOR_WIDTH = 15

function translatePoint(x, y) {
    return {
        x: (x - X_MIN) / (X_MAX - X_MIN) * CANVAS_WIDTH,
        y: (1 - (y - Y_MIN) / (Y_MAX - Y_MIN)) * CANVAS_WIDTH,
    }
}

const state = {
    cursorEnabled: true,
    cursorDelta: 0.25,

    // Find something on screen?
    cursorX: 0,

    isPlaying: false,

    volume: 0.2,
    speed: 1,

    currentQuestionIndex: 0,
}

function setState(newState) {
    for (let key in newState) {
        if (newState.hasOwnProperty(key)) {
            state[key] = newState[key]
        }
    }

    draw()
}

const fns = [
    ["f(x) = x", (x) => x],
    ["f(x) = \frac{x^2}{10}", (x) => x*x/10],
    ["f(x) = x^3/12 - 31x/12 + 5/2", (x) => x*x*x/12 - 31*x/12 + 5/2],
    ["f(x) = |x|", (x) => Math.abs(x)],
    ["f(x) = 5*sin(x)", (x) => 5*Math.sin(x)],
    ["f(x) = tan(x/2)", (x) => Math.tan(x/2)],
]

const questions = [
    {
        choices: [
            ["y = \\frac{x^2}{10}", (x) => x*x/10],
            ["y = 5x + 3"],
            ["y = 2x - 3"],
            ["y = x"],
        ],
    },

    {
        choices: [
            ["y = -\\frac{x^2}{15}", (x) => -x*x/15],
            ["y = \\frac{x^2}{15}"],
            ["y = \\frac{x^2}{8} + 5"],
            ["y = 5x + 8"],
        ],
    },

    {
        choices: [
            ["y = x", (x) => x],
            ["y = -x"],
            ["y = x^2"],
            ["y = -x^2"],
        ],
    },

    // Require the use of scrubbing!
    {
        choices: [
            ["y = \\frac{x}{2}", (x) => x/2],
            ["y = x"],
            ["y = \\frac{x}{3}"],
            ["y = 2x"],
        ],
    },

    // Require the use of scrubbing!
    {
        choices: [
            ["y = \\frac{x^2}{10}", (x) => x*x/10],
            ["y = x^2"],
            ["y = 2x^2"],
            ["y = x^4"],
        ],
    },

    {
        choices: [
            ["y = 5sin(x)", (x) => 5*Math.sin(x)],
            ["y = x^3"],
            ["y = tan(x)"],
            ["y = x^4"],
        ],
    },

    // Requires scrubber!
    {
        choices: [
            ["y = 3sin(x)", (x) => 3*Math.sin(x)],
            ["y = sin(x)"],
            ["y = 5sin(x)"],
            ["y = 9sin(x)"],
        ],
    },

    // Requires scrubber!
    {
        choices: [
            ["y = 5cos(x)", (x) => 5*Math.cos(x)],
            ["y = sin(x)"],
            ["y = 5sin(x)"],
            ["y = 9sin(x)"],
        ],
    },
]

const buttonHandlers = []

// Scramble ze questions!
questions.forEach((question) => {
    const choices = question.choices.slice(1)
    const shuffled = _.shuffle(choices)

    const insertIndex = Math.floor(Math.random() * (choices.length + 1))
    choices.splice(insertIndex, 0, question.choices[0])

    question.choices = choices
    question.correctIndex = insertIndex
})

function wireButtons() {
    for (let i = 1; i <= 4; i++) {
        const button = document.getElementById("choice-" + i)
        const question = questions[state.currentQuestionIndex]

        if (buttonHandlers[i-1]) {
            button.removeEventListener("click", buttonHandlers[i-1])
        }

        const buildHandler = (i, question, button) => {
            return (e) => {
                e.preventDefault()

                // Wow these are awful
                if (i - 1 === question.correctIndex) {
                    // You got it right!
                    document.getElementById("sound").play()

                    button.classList.add("success")
                    setTimeout(() => {
                        button.classList.remove("success")
                    }, 16)

                    setTimeout(() => {
                        const newIndex = state.currentQuestionIndex + 1
                        setState({
                            currentQuestionIndex: newIndex % questions.length,
                            cursorX: 0,
                        })
                    }, 600)
                } else {
                    // Not right yet

                    button.classList.add("error")
                    setTimeout(() => {
                        button.classList.remove("error")
                    }, 16)
                }
            }
        }

        const handler = buildHandler(i, question, button)

        buttonHandlers[i-1] = handler
        button.addEventListener("click", handler)
    }
}

function renderQuestion() {
    const question = questions[state.currentQuestionIndex]
    for (let i = 1; i <= 4; i++) {
        const button = document.getElementById("choice-" + i)
        katex.render(question.choices[i-1][0], button);
    }

    wireButtons()
}

function currentFn(x) {
    const question = questions[state.currentQuestionIndex]
    return question.choices[question.correctIndex][1](x)
}

function drawVerticalGrid() {
    for (let i = X_MIN; i <= X_MAX; i += GRID_SIZE) {
        ctx.beginPath()
        const a = translatePoint(i, Y_MIN)
        ctx.moveTo(a.x, a.y)
        const b = translatePoint(i, Y_MAX)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
    }
}

function drawHorizontalGrid() {
    for (let i = Y_MIN; i <= Y_MAX; i += GRID_SIZE) {
        ctx.beginPath()
        const a = translatePoint(X_MIN, i)
        ctx.moveTo(a.x, a.y)
        const b = translatePoint(X_MAX, i)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
    }
}

function drawXAxis() {
    ctx.save()
    ctx.lineWidth = 5
    ctx.beginPath()
    const a = translatePoint(X_MIN, 0)
    ctx.moveTo(a.x, a.y)
    const b = translatePoint(X_MAX, 0)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.restore()
}

function drawYAxis() {
    ctx.save()
    ctx.beginPath()
    ctx.lineWidth = 5
    const a = translatePoint(0, Y_MIN)
    ctx.moveTo(a.x, a.y)
    const b = translatePoint(0, Y_MAX)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.restore()
}

function drawEquation() {
    ctx.save()
    ctx.beginPath()
    ctx.lineWidth = 5
    ctx.strokeStyle = "#66b5ff"

    const init = translatePoint(X_MIN, currentFn(X_MIN))
    ctx.moveTo(init.x, init.y)

    for (let x = X_MIN; x <= X_MAX; x += DELTA) {
        const coord = translatePoint(x, currentFn(x))
        ctx.lineTo(coord.x, coord.y)
    }

    ctx.stroke()
    ctx.restore()
}

function drawCursor() {
    const cursorCenter = translatePoint(
        state.cursorX, currentFn(state.cursorX))

    ctx.save()
    ctx.fillStyle = "#06b5ff"
    ctx.beginPath()
    ctx.arc(
        cursorCenter.x, cursorCenter.y, CURSOR_WIDTH, 0, Math.PI*2, true)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
}

function duration() {
    return (X_MAX - X_MIN) / (state.speed * 8)
}

function yToFreq(y) {
    const KEYS = 88

    // Map to a key
    const key = (y - Y_MIN) / (Y_MAX - Y_MIN) * KEYS + 1

    if (key > KEYS) {
        return 0
    } else {
        return Math.pow(2, (key - 49) / 12) * 440
    }
}

function stopSound() {
    osc.stop(audioCtx.currentTime)
    // Clear the timeout so we don't accidentally claim we're not playing
    clearTimeout(timeout)
}

function playGraph() {
    if (state.isPlaying) {
        stopSound()
    }

    setState({ isPlaying: true })

    osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    gain.gain.value = state.volume

    for (let x = X_MIN; x <= X_MAX; x += TONE_DELTA) {
        const time = (x - X_MIN) / (X_MAX - X_MIN) * duration()

        osc.frequency.setValueAtTime(
            yToFreq(currentFn(x)),
            audioCtx.currentTime + time)
    }

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    // Play the source
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + duration())

    // Change the state that we're not playing anymore
    timeout = setTimeout(function() {
        setState({ isPlaying: false })
    }, duration() * 1000)
}

function playSound(x) {
    if (state.isPlaying) {
        stopSound()
    }

    osc = audioCtx.createOscillator()

    const gain = audioCtx.createGain()
    gain.gain.value = state.volume

    osc.frequency.value = yToFreq(currentFn(x))

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + 0.1)
}

function announceCoords(slow) {
    if (slow) {
        voice.rate = 1
    }

    speechSynthesis.cancel()
    voice.text = round(state.cursorX) + "; " + round(currentFn(state.cursorX))
    speechSynthesis.speak(voice)
    voice.rate = DEFAULT_RATE
}

document.addEventListener("keydown", function(e) {
    if (e.keyCode >= 49 && e.keyCode <= 57) {
        setState({ currentQuestionIndex: e.keyCode - 49 })
    }

    // P
    if (e.keyCode === 80) {
        playGraph()
    }

    // Left
    if (e.keyCode === 37) {
        const newCursorX = state.cursorX - state.cursorDelta
        setState({ cursorX: newCursorX })
        playSound(newCursorX)
        announceCoords()
    }

    // Right
    if (e.keyCode === 39) {
        const newCursorX = state.cursorX + state.cursorDelta
        setState({ cursorX: newCursorX })
        playSound(newCursorX)
        announceCoords()
    }

    // A
    if (e.keyCode === 65) {
        announceCoords(true /* slow */)
    }

    // S
    if (e.keyCode === 83) {
        playSound(state.cursorX)
    }

    // W
    if (e.keyCode === 87) {
        setState({
            speed: state.speed * 2
        })
        playGraph()
    }

    // Q
    if (e.keyCode === 81) {
        setState({
            speed: state.speed / 2
        })
        playGraph()
    }
})

function round(v) {
    return Math.round(v * 1000) / 1000
}

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    drawHorizontalGrid()
    drawVerticalGrid()
    drawXAxis()
    drawYAxis()
    drawEquation()
    drawCursor()

    document.getElementById("question").innerText =
        state.currentQuestionIndex + 1

    renderQuestion()
}

draw()
