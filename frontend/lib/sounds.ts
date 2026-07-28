class POSSounds {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  enabled = true;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.5;

    const resume = () => {
      if (this.ctx?.state === "suspended") this.ctx.resume();
    };
    document.addEventListener("click", resume, { once: true });
    document.addEventListener("keydown", resume, { once: true });
  }

  private play(
    freq: number,
    type: OscillatorType,
    duration: number,
    gainValue = 0.3,
  ) {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      this.ctx.currentTime + duration,
    );
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  click() {
    this.play(1000, "sine", 0.01, 0.1);
  }

  scan() {
    this.play(1500, "square", 0.02, 0.2);
  }

  addItem() {
    this.play(880, "sine", 0.1, 0.3);
  }

  error() {
    this.play(200, "square", 0.2, 0.3);
  }

  hold() {
    this.play(600, "sine", 0.05, 0.2);
    setTimeout(() => this.play(600, "sine", 0.05, 0.2), 100);
  }

  success() {
    this.play(523, "sine", 0.1, 0.3);
    setTimeout(() => this.play(659, "sine", 0.15, 0.3), 100);
  }
}

export const sounds = new POSSounds();
