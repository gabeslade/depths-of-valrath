// ============================================================
// DEPTHS OF VALRATH — Audio System (Web Audio API)
// ============================================================

class AudioSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.3;
        this.initialized = false;
        this.ambientNode = null;
        this.ambientGain = null;
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not available');
            this.initialized = false;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(vol) {
        this.volume = clamp(vol, 0, 1);
        if (this.masterGain) {
            this.masterGain.gain.value = this.volume;
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.masterGain) {
            this.masterGain.gain.value = this.enabled ? this.volume : 0;
        }
    }

    // Play a note/tone
    _playTone(freq, duration, type, volume, delay) {
        if (!this.initialized || !this.enabled) return;

        const startTime = this.ctx.currentTime + (delay || 0);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type || 'square';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume || 0.2, startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
    }

    // Play noise burst
    _playNoise(duration, volume, bandpass) {
        if (!this.initialized || !this.enabled) return;

        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume || 0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        if (bandpass) {
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = bandpass;
            filter.Q.value = 1;
            source.connect(filter);
            filter.connect(gain);
        } else {
            source.connect(gain);
        }

        gain.connect(this.masterGain);
        source.start();
    }

    // Sound effects
    playFootstep() {
        this._playNoise(0.05, 0.05, 800);
    }

    playHit() {
        this._playNoise(0.1, 0.15, 400);
        this._playTone(120, 0.1, 'sawtooth', 0.1);
    }

    playCriticalHit() {
        this._playNoise(0.15, 0.2, 300);
        this._playTone(200, 0.1, 'sawtooth', 0.15);
        this._playTone(300, 0.1, 'square', 0.1, 0.05);
    }

    playMiss() {
        this._playNoise(0.08, 0.05, 2000);
    }

    playEnemyDeath() {
        this._playTone(300, 0.15, 'sawtooth', 0.12);
        this._playTone(200, 0.2, 'sawtooth', 0.1, 0.08);
        this._playTone(100, 0.3, 'sawtooth', 0.08, 0.15);
    }

    playPlayerHit() {
        this._playTone(150, 0.15, 'sawtooth', 0.2);
        this._playNoise(0.1, 0.15, 200);
    }

    playPickup() {
        this._playTone(600, 0.08, 'square', 0.1);
        this._playTone(800, 0.08, 'square', 0.1, 0.06);
    }

    playGoldPickup() {
        this._playTone(800, 0.06, 'sine', 0.12);
        this._playTone(1000, 0.06, 'sine', 0.1, 0.04);
        this._playTone(1200, 0.08, 'sine', 0.08, 0.08);
    }

    playPotion() {
        this._playTone(400, 0.1, 'sine', 0.1);
        this._playTone(600, 0.15, 'sine', 0.12, 0.08);
        this._playTone(800, 0.1, 'sine', 0.08, 0.16);
    }

    playLevelUp() {
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            this._playTone(freq, 0.2, 'square', 0.12, i * 0.1);
            this._playTone(freq, 0.3, 'sine', 0.08, i * 0.1);
        });
    }

    playStairs() {
        this._playTone(300, 0.15, 'sine', 0.1);
        this._playTone(400, 0.15, 'sine', 0.1, 0.1);
        this._playTone(500, 0.2, 'sine', 0.12, 0.2);
    }

    playSpellCast() {
        this._playTone(800, 0.1, 'sine', 0.1);
        this._playTone(1200, 0.15, 'sine', 0.12, 0.05);
        this._playNoise(0.1, 0.08, 3000);
    }

    playFireball() {
        this._playNoise(0.3, 0.2, 200);
        this._playTone(100, 0.3, 'sawtooth', 0.15);
        this._playTone(80, 0.4, 'sawtooth', 0.1, 0.1);
    }

    playIce() {
        this._playTone(2000, 0.1, 'sine', 0.08);
        this._playTone(1500, 0.15, 'sine', 0.1, 0.05);
        this._playNoise(0.1, 0.06, 4000);
    }

    playLightning() {
        this._playNoise(0.2, 0.25, 1500);
        this._playTone(100, 0.1, 'sawtooth', 0.15);
        this._playNoise(0.1, 0.15, 800);
    }

    playHeal() {
        this._playTone(523, 0.15, 'sine', 0.1);
        this._playTone(659, 0.15, 'sine', 0.1, 0.08);
        this._playTone(784, 0.2, 'sine', 0.12, 0.16);
    }

    playDoor() {
        this._playNoise(0.1, 0.08, 300);
        this._playTone(200, 0.1, 'square', 0.06);
    }

    playDeath() {
        const notes = [400, 350, 300, 200, 150];
        notes.forEach((freq, i) => {
            this._playTone(freq, 0.3, 'sawtooth', 0.15 - i * 0.02, i * 0.15);
        });
        this._playNoise(0.5, 0.1, 100);
    }

    playVictory() {
        const melody = [523, 659, 784, 1047, 784, 1047, 1319];
        melody.forEach((freq, i) => {
            this._playTone(freq, 0.25, 'square', 0.12, i * 0.15);
            this._playTone(freq, 0.3, 'sine', 0.08, i * 0.15);
        });
    }

    playBossAlert() {
        this._playTone(150, 0.3, 'sawtooth', 0.15);
        this._playTone(100, 0.4, 'sawtooth', 0.2, 0.25);
        this._playTone(80, 0.5, 'sawtooth', 0.15, 0.5);
    }

    playShopBuy() {
        this._playTone(1000, 0.08, 'sine', 0.1);
        this._playTone(1200, 0.08, 'sine', 0.1, 0.06);
        this._playTone(1500, 0.1, 'sine', 0.08, 0.12);
    }

    // Ambient drone
    startAmbient() {
        if (!this.initialized || !this.enabled) return;
        if (this.ambientNode) return;

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.03;
        this.ambientGain.connect(this.masterGain);

        // Deep drone
        this.ambientNode = this.ctx.createOscillator();
        this.ambientNode.type = 'sine';
        this.ambientNode.frequency.value = 55;

        // LFO for subtle movement
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 0.2;
        lfoGain.gain.value = 5;
        lfo.connect(lfoGain);
        lfoGain.connect(this.ambientNode.frequency);
        lfo.start();

        this.ambientNode.connect(this.ambientGain);
        this.ambientNode.start();
    }

    stopAmbient() {
        if (this.ambientNode) {
            this.ambientNode.stop();
            this.ambientNode = null;
        }
    }
}
