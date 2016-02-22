"use strict"

const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

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

const fns = [
    ["f(x) = x", (x) => x],
    ["f(x) = x^2/10", (x) => x*x/10],
    ["f(x) = x^3/12 - 31x/12 + 5/2", (x) => x*x*x/12 - 31*x/12 + 5/2],
    ["f(x) = |x|", (x) => Math.abs(x)],
    ["f(x) = 5*sin(x)", (x) => 5*Math.sin(x)],
    ["f(x) = tan(x/2)", (x) => Math.tan(x/2)],

];

function currentFn(x) {
    return fns[state.currentFnIndex][1](x)
}

const functionSelect = document.getElementById("function")
for (let i = 0; i < fns.length; i++) {
    const option = document.createElement("option")
    option.value = i
    option.innerHTML = fns[i][0]

    functionSelect.appendChild(option)
}

functionSelect.addEventListener("change", (e) => {
    setState({
        currentFnIndex: +e.target.value,
    })
})

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

const state = {
    cursorEnabled: true,
    cursorDelta: 0.25,

    // Find something on screen?
    cursorX: 0,

    isPlaying: false,

    volume: 0.2,
    speed: 1,

    currentFnIndex: 0,
}

function setState(newState) {
    for (let key in newState) {
        if (newState.hasOwnProperty(key)) {
            state[key] = newState[key]
        }
    }

    draw()
}

function duration() {
    return (X_MAX - X_MIN) / (state.speed * 8)
}

function playSound() {
    if (state.isPlaying) {
        return;
    }

    setState({ isPlaying: true })

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    gain.gain.value = state.volume

    const KEYS = 88
    for (let x = X_MIN; x <= X_MAX; x += TONE_DELTA) {
        const value = currentFn(x)

        // Map to a key
        const key = (value - Y_MIN) / (Y_MAX - Y_MIN) * KEYS + 1

        let freq;
        if (key > KEYS) {
            freq = 0
        } else {
            freq = Math.pow(2, (key - 49) / 12) * 440
        }

        const time = (x - X_MIN) / (X_MAX - X_MIN) * duration()
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + time)
    }

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    // Play the source
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + duration())

    // Change the state that we're not playing anymore
    setTimeout(function() {
        setState({ isPlaying: false })
    }, duration() * 1000)
}

document.addEventListener("keydown", function(e) {
    console.log(e.keyCode)

    // P
    if (e.keyCode === 80) {
        playSound()
    } else if (e.keyCode === 37) {
        setState({
            cursorX: state.cursorX - state.cursorDelta,
        })
    } else if (e.keyCode === 39) {
        setState({
            cursorX: state.cursorX + state.cursorDelta,
        })

    // W
    } else if (e.keyCode === 87) {
        setState({
            speed: state.speed * 2
        })
        playSound()

    // Q
    } else if (e.keyCode === 81) {
        setState({
            speed: state.speed / 2
        })
        playSound()
    }
})

function draw() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawHorizontalGrid()
    drawVerticalGrid()
    drawXAxis()
    drawYAxis()
    drawEquation()

    if (state.cursorEnabled) {
        const cursorCenter = translatePoint(state.cursorX, currentFn(state.cursorX))
        ctx.save()
        ctx.fillStyle = "#06b5ff"
        ctx.beginPath()
        ctx.arc(
            cursorCenter.x, cursorCenter.y, CURSOR_WIDTH, 0, Math.PI*2, true)
        ctx.closePath()
        ctx.fill()
        ctx.restore()

        cursorXDisplay.innerText = Math.round(state.cursorX * 1000) / 1000
        cursorYDisplay.innerText = Math.round(currentFn(state.cursorX) * 1000) / 1000

        cursorInfoDisplay.classList.remove("hidden")
    } else {
        cursorInfoDisplay.classList.add("hidden")
    }

    document.getElementById("speed").innerText = state.speed
}

draw()
