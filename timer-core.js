/**
 * Auditorium Timer - Core Synchronization Engine
 * Handles drift-free timestamp timing and real-time cross-window synchronization
 * via BroadcastChannel and localStorage events.
 */

const STORAGE_KEY = 'auditorium_timer_state_v1';
const CHANNEL_NAME = 'auditorium_timer_channel';

class TimerEngine {
  constructor(isMaster = false) {
    this.isMaster = isMaster;
    this.listeners = new Set();
    this.channel = null;

    // Default state
    this.state = {
      status: 'idle', // 'idle' | 'running' | 'paused' | 'timeup'
      totalDurationSec: 600, // 10 minutes default
      remainingSec: 600,
      endTimestamp: null,
      pausedRemainingSec: 600,
      warningSec: 60, // 1 minute default (amber alert)
      dangerSec: 30,  // 30 seconds default (red alert)
      isTimeUp: false,
      soundEnabled: true,
      volume: 0.8,
      message: '',
      messageVisible: false,
      blackout: false,
      speakerName: '',
      talkTitle: '',
      timeFormat: 'standard', // 'standard' (MM:SS) | 'seconds' (SS) | 'auto' (MM:SS then SS under 1m)
      theme: 'cyber-black',   // 'cyber-black' | 'high-contrast' | 'warm-gold' | 'neon-matrix' | 'daylight-clean' | 'midnight-navy'
      lastAlertLevel: 'normal', // 'normal' | 'warning' | 'danger' | 'timeup'
      lastUpdateTimestamp: Date.now()
    };

    this._initChannel();
    this._loadPersistedState();
    this._startRenderLoop();
  }

  _initChannel() {
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        this._handleRemoteMessage(event.data);
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported, falling back to storage events', e);
    }

    // Storage event fallback for older browsers or cross-tab safety
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const remoteState = JSON.parse(e.newValue);
          this._applyRemoteState(remoteState);
        } catch (err) {
          console.error('Storage sync error', err);
        }
      }
    });
  }

  _loadPersistedState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() - (parsed.lastUpdateTimestamp || 0) < 24 * 3600 * 1000) {
          this.state = { ...this.state, ...parsed };
          if (this.state.status === 'running' && this.state.endTimestamp) {
            this._computeTime();
          }
        }
      }
    } catch (e) {
      console.warn('Could not read saved state', e);
    }
  }

  _broadcast(actionType, extraData = {}) {
    this.state.lastUpdateTimestamp = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {}

    if (this.channel) {
      this.channel.postMessage({
        type: actionType,
        state: this.state,
        ...extraData
      });
    }
    this._notify();
  }

  _handleRemoteMessage(data) {
    if (!data || !data.type) return;

    if (data.type === 'SYNC_REQUEST') {
      if (this.isMaster) {
        this._broadcast('STATE_UPDATE');
      }
      return;
    }

    if (data.type === 'STATE_UPDATE' || data.type === 'ACTION') {
      this._applyRemoteState(data.state);
      if (data.soundTrigger && window.stageAudio) {
        this._triggerSound(data.soundTrigger);
      }
    }
  }

  _applyRemoteState(remoteState) {
    if (!remoteState) return;
    this.state = { ...this.state, ...remoteState };

    if (window.stageAudio) {
      window.stageAudio.setEnabled(this.state.soundEnabled);
      window.stageAudio.setVolume(this.state.volume);
    }

    this._computeTime();
    this._notify();
  }

  _triggerSound(soundType) {
    if (!this.state.soundEnabled || !window.stageAudio) return;
    if (soundType === 'warning') window.stageAudio.playWarningChime();
    if (soundType === 'danger') window.stageAudio.playDangerAlert();
    if (soundType === 'timeup') window.stageAudio.playTimeUpSound();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    this.listeners.forEach(cb => {
      try { cb(this.state); } catch (e) { console.error(e); }
    });
  }

  // Drift-free calculation based on system clock
  _computeTime() {
    if (this.state.status === 'running' && this.state.endTimestamp) {
      const now = Date.now();
      const diffMs = this.state.endTimestamp - now;

      if (diffMs > 0) {
        this.state.remainingSec = Math.ceil(diffMs / 1000);
        this.state.isTimeUp = false;
      } else {
        // HIT ZERO: Freeze at 0, no negative counting, just flash!
        this.state.remainingSec = 0;
        this.state.isTimeUp = true;
        this.state.status = 'timeup';
      }

      // Determine current alert level
      const currentLevel = this.getCurrentAlertLevel();
      if (this.isMaster && currentLevel !== this.state.lastAlertLevel) {
        let soundToTrigger = null;
        if (currentLevel === 'warning') soundToTrigger = 'warning';
        if (currentLevel === 'danger') soundToTrigger = 'danger';
        if (currentLevel === 'timeup') soundToTrigger = 'timeup';

        this.state.lastAlertLevel = currentLevel;
        if (soundToTrigger) {
          this._triggerSound(soundToTrigger);
          this._broadcast('ACTION', { soundTrigger: soundToTrigger });
        }
      }
    } else if (this.state.status === 'paused' || this.state.status === 'idle') {
      this.state.remainingSec = this.state.pausedRemainingSec;
      this.state.isTimeUp = false;
    } else if (this.state.status === 'timeup') {
      this.state.remainingSec = 0;
      this.state.isTimeUp = true;
    }
  }

  getCurrentAlertLevel() {
    if (this.state.isTimeUp || this.state.remainingSec <= 0) return 'timeup';
    if (this.state.remainingSec <= this.state.dangerSec && this.state.remainingSec > 0) return 'danger';
    if (this.state.remainingSec <= this.state.warningSec && this.state.remainingSec > 0) return 'warning';
    return 'normal';
  }

  _startRenderLoop() {
    const loop = () => {
      if (this.state.status === 'running') {
        const oldRem = this.state.remainingSec;
        this._computeTime();
        if (oldRem !== this.state.remainingSec || this.state.isTimeUp) {
          this._notify();
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // --- CONTROLLER ACTIONS ---

  setDuration(seconds) {
    const sec = Math.max(1, parseInt(seconds, 10));
    this.state.totalDurationSec = sec;
    this.state.remainingSec = sec;
    this.state.pausedRemainingSec = sec;
    this.state.isTimeUp = false;
    this.state.status = 'idle';
    this.state.lastAlertLevel = 'normal';
    this._broadcast('ACTION');
  }

  start() {
    if (this.state.status === 'running') return;

    const remaining = this.state.pausedRemainingSec > 0 ? this.state.pausedRemainingSec : this.state.totalDurationSec;
    this.state.status = 'running';
    this.state.endTimestamp = Date.now() + (remaining * 1000);
    this.state.isTimeUp = false;
    this.state.lastAlertLevel = this.getCurrentAlertLevel();
    this._broadcast('ACTION');
  }

  pause() {
    if (this.state.status !== 'running') return;
    this.state.status = 'paused';
    this.state.pausedRemainingSec = this.state.remainingSec;
    this.state.endTimestamp = null;
    this._broadcast('ACTION');
  }

  reset() {
    this.state.status = 'idle';
    this.state.remainingSec = this.state.totalDurationSec;
    this.state.pausedRemainingSec = this.state.totalDurationSec;
    this.state.endTimestamp = null;
    this.state.isTimeUp = false;
    this.state.lastAlertLevel = 'normal';
    this._broadcast('ACTION');
  }

  addTime(seconds) {
    const add = parseInt(seconds, 10);
    if (this.state.status === 'running') {
      this.state.endTimestamp += (add * 1000);
      this._computeTime();
    } else {
      this.state.pausedRemainingSec = Math.max(0, this.state.pausedRemainingSec + add);
      this.state.remainingSec = this.state.pausedRemainingSec;
    }
    if (this.state.remainingSec > 0) {
      this.state.isTimeUp = false;
      if (this.state.status === 'timeup') this.state.status = 'paused';
    }
    this.state.lastAlertLevel = this.getCurrentAlertLevel();
    this._broadcast('ACTION');
  }

  setWarningThresholds(warningSec, dangerSec) {
    this.state.warningSec = Math.max(1, parseInt(warningSec, 10));
    this.state.dangerSec = Math.max(1, parseInt(dangerSec, 10));
    this.state.lastAlertLevel = this.getCurrentAlertLevel();
    this._broadcast('ACTION');
  }

  setTimeFormat(format) {
    this.state.timeFormat = format; // 'standard' | 'seconds' | 'auto'
    this._broadcast('ACTION');
  }

  setTheme(themeName) {
    this.state.theme = themeName;
    this._broadcast('ACTION');
  }

  setMessage(msg, visible = true) {
    this.state.message = msg.trim();
    this.state.messageVisible = visible && this.state.message.length > 0;
    this._broadcast('ACTION');
  }

  clearMessage() {
    this.state.message = '';
    this.state.messageVisible = false;
    this._broadcast('ACTION');
  }

  setBlackout(isBlackout) {
    this.state.blackout = !!isBlackout;
    this._broadcast('ACTION');
  }

  setSpeakerInfo(name, title) {
    this.state.speakerName = (name || '').trim();
    this.state.talkTitle = (title || '').trim();
    this._broadcast('ACTION');
  }

  setSound(enabled, volume = null) {
    this.state.soundEnabled = !!enabled;
    if (volume !== null) this.state.volume = Math.max(0, Math.min(1, parseFloat(volume)));
    if (window.stageAudio) {
      window.stageAudio.setEnabled(this.state.soundEnabled);
      window.stageAudio.setVolume(this.state.volume);
    }
    this._broadcast('ACTION');
  }

  requestSync() {
    if (this.channel) {
      this.channel.postMessage({ type: 'SYNC_REQUEST' });
    }
  }

  // Format seconds into string based on requested format
  static formatDisplayTime(totalSeconds, format = 'standard') {
    const sec = Math.max(0, Math.floor(totalSeconds));

    if (format === 'seconds') {
      return `${sec}`;
    }

    if (format === 'auto' && sec < 60) {
      return `${sec}`;
    }

    return TimerEngine.formatTime(sec);
  }

  // Standard HH:MM:SS or MM:SS
  static formatTime(totalSeconds) {
    const sec = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }
}

window.TimerEngine = TimerEngine;
