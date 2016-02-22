"use strict"

const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const DELTA = 0.01
const CANVAS_WIDTH = canvas.width
const CANVAS_HEIGHT = canvas.height

// Make dese controllable
const Y_MIN = -10
const Y_MAX = 10
const X_MIN = -10
const X_MAX = 10
const GRID_SIZE = 1

const cursorInfoDisplay = document.getElementById("cursor-info")
const cursorXDisplay = document.getElementById("cursor-x")
const cursorYDisplay = document.getElementById("cursor-y")

const CURSOR_WIDTH = 15

function translatePoint(x, y) {
    return {
        x: (x - X_MIN) / (X_MAX - X_MIN) * CANVAS_WIDTH,
        y: (1 - (y - Y_MIN) / (Y_MAX - Y_MIN)) * CANVAS_WIDTH,
    }
}

let fn = (x) => x * x / 10 - 2

fn = (x) => x / 3 - 2

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

function drawEquation(f) {
    ctx.save()
    ctx.beginPath()
    ctx.lineWidth = 5
    ctx.strokeStyle = "#66b5ff"

    const init = translatePoint(X_MIN, f(X_MIN))
    ctx.moveTo(init.x, init.y)

    for (let x = X_MIN; x <= X_MAX; x += DELTA) {
        const coord = translatePoint(x, f(x))
        ctx.lineTo(coord.x, coord.y)
    }

    ctx.stroke()
    ctx.restore()
}

const state = {
    cursorEnabled: true,
    cursorDelta: 1,

    // Find something on screen?
    cursorX: 0,

    isPlaying: false,

    volume: 0.2,
    duration: 0.5,
}

function setState(newState) {
    for (let key in newState) {
        if (newState.hasOwnProperty(key)) {
            state[key] = newState[key]
        }
    }

    draw()
}

function playSound() {
    setState({ isPlaying: true })

    const duration = state.duration
    const volume = state.volume

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    gain.gain.value = volume
    osc.frequency.value = 440

    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + duration)

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    setTimeout(function() {
        setState({ isPlaying: false })
    }, duration * 1000)
}

document.addEventListener("keydown", function(e) {
    if (e.keyCode === 32) {
        if (!state.isPlaying) {
            playSound()
        }
    } else if (e.keyCode === 37) {
        setState({
            cursorX: state.cursorX - state.cursorDelta,
        })
    } else if (e.keyCode === 39) {
        setState({
            cursorX: state.cursorX + state.cursorDelta,
        })
    }
})

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawHorizontalGrid()
    drawVerticalGrid()
    drawXAxis()
    drawYAxis()
    drawEquation(fn)

    if (state.cursorEnabled) {
        const cursorCenter = translatePoint(state.cursorX, fn(state.cursorX))
        ctx.save()
        ctx.fillStyle = "#06b5ff"
        ctx.beginPath()
        ctx.arc(
            cursorCenter.x, cursorCenter.y, CURSOR_WIDTH, 0, Math.PI*2, true)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

        cursorXDisplay.innerText = Math.round(state.cursorX * 1000) / 1000
        cursorYDisplay.innerText = Math.round(fn(state.cursorX) * 1000) / 1000

        cursorInfoDisplay.classList.remove("hidden")
    } else {
        cursorInfoDisplay.classList.add("hidden")
    }
}

draw()
