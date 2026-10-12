# 🏛️ Auditorium Dual-Screen Countdown Timer

A professional broadcast-grade countdown timer system designed for **auditoriums, conferences, stage presentations, and seminars**. Features instant cross-window synchronization between the operator control desk and the stage display projector.

---

## 🚀 Quick Start

1. Start a local web server in this folder (or use the one already running on port 8080):
   ```bash
   python -m http.server 8080
   ```
2. Open in your browser:
   - **Operator Console:** [http://localhost:8080/index.html](http://localhost:8080/index.html)
   - **Auditorium Stage Display:** [http://localhost:8080/display.html](http://localhost:8080/display.html)
   - **Dual Screen Simulator (Side-by-Side):** [http://localhost:8080/split.html](http://localhost:8080/split.html)

---

## 🌟 Key Features

### 1. 🖥️ Auditorium Stage Display (`display.html`)
- **Auto-Fitting Giant Digits**: Fills 100% of the screen width and height using responsive viewport scaling so people in the back of large halls can clearly see the time.
- **Multi-Stage Visual Warnings**:
  - 🟢 **Normal Mode**: Crisp ice-white on deep stage black with progress bar.
  - 🟡 **Warning Mode** (Configurable, default 2 mins): Vibrant amber glow alert.
  - 🔴 **Critical/Danger Mode** (Configurable, default 30s): Pulsing high-contrast coral red alert.
  - 🚨 **Overtime Mode**: Negative counter (`-01:25`) with flashing overtime badge so speakers and audiences know time has expired.
- **Stage Message Banner**: Real-time broadcast prompts (e.g., *"2 MINUTES LEFT - WRAP UP"*, *"START AUDIENCE Q&A"*).
- **Auto-Hiding Cursor**: Cursor and buttons automatically hide after 3 seconds of inactivity for a clean stage look.
- **Keyboard Shortcuts**:
  - `F` - Toggle Fullscreen
  - `M` - Toggle Sound Chimes

### 2. 🎛️ Operator Control Desk (`index.html`)
- **Live Stage Monitor**: Real-time mirror showing exact stage status, timer, warning alerts, and broadcast messages.
- **Presets & Custom Duration**: One-click session presets (`3m`, `5m`, `10m`, `15m`, `20m`, `30m`, `45m`, `60m`) or custom `HH:MM:SS`.
- **Live Time Adjustments**: Instant `+1 Min`, `-1 Min`, `+30s`, `-30s`, `+5 Min`.
- **Warning Threshold Sliders**: Adjust Amber and Red warning trigger times on the fly.
- **Speaker & Session Info**: Enter speaker name and presentation title to show on the stage header.
- **Stage Prompts Broadcaster**: Send custom or quick-preset messages to the stage screen.
- **Audio Chimes & Blackout**: Toggle chimes, test alert sounds, or blank the projector between sessions.
- **1-Click Launch**: "Launch Stage Display" button opens a dedicated window to drag onto the second monitor/projector.

### 3. 🔊 Web Audio API Synthesizer (`audio.js`)
- Gentle dual-tone auditorium chime on entering the warning phase.
- Double-beep alert on entering the danger phase.
- Resonant chime gong when time reaches `00:00`.
- 100% offline with zero external audio assets required.

### 4. ⚡ Drift-Free Real-Time Sync (`timer-core.js`)
- Synchronized across browser windows, tabs, and monitors using native `BroadcastChannel` and `localStorage` events.
- Computed using epoch timestamps (`Date.now()`) to eliminate timing drift even in background tabs.
