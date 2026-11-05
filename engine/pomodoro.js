// Minuteur Pomodoro géré par le processus principal pour continuer fenêtre fermée.
const PHASE_LABELS = { work: 'Concentration', shortBreak: 'Petite pause', longBreak: 'Grande pause' };

class Pomodoro {
  constructor(getConfig, onChange, onPhaseEnd) {
    this.getConfig = getConfig;
    this.onChange = onChange;
    this.onPhaseEnd = onPhaseEnd;
    this.timer = null;
    this.reset();
  }

  durationOf(phase) {
    return (Number(this.getConfig()[phase]) || 1) * 60000;
  }

  state() {
    const remaining = this.running ? Math.max(0, this.endsAt - Date.now()) : this.remaining;
    return {
      phase: this.phase,
      label: PHASE_LABELS[this.phase],
      running: this.running,
      remaining,
      total: this.durationOf(this.phase),
      cycles: this.cycles,
      activityTitle: this.activityTitle,
    };
  }

  reset() {
    clearInterval(this.timer);
    this.phase = 'work';
    this.running = false;
    this.cycles = 0;
    this.remaining = this.durationOf('work');
    this.endsAt = 0;
    this.activityTitle = '';
    this.emit();
  }

  start(activityTitle) {
    if (activityTitle !== undefined) this.activityTitle = activityTitle;
    if (this.running) return;
    this.running = true;
    this.endsAt = Date.now() + this.remaining;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 1000);
    this.emit();
  }

  pause() {
    if (!this.running) return;
    this.remaining = Math.max(0, this.endsAt - Date.now());
    this.running = false;
    clearInterval(this.timer);
    this.emit();
  }

  skip() {
    this.advance(false);
  }

  tick() {
    if (Date.now() >= this.endsAt) this.advance(true);
    else this.emit();
  }

  advance(notify) {
    const finished = this.phase;
    if (finished === 'work') {
      this.cycles += 1;
      const every = Number(this.getConfig().cyclesBeforeLong) || 4;
      this.phase = this.cycles % every === 0 ? 'longBreak' : 'shortBreak';
    } else {
      this.phase = 'work';
    }
    const wasRunning = this.running;
    this.running = false;
    clearInterval(this.timer);
    this.remaining = this.durationOf(this.phase);
    if (notify) this.onPhaseEnd(finished, this.phase, PHASE_LABELS[this.phase]);
    // On enchaîne automatiquement sur la phase suivante
    if (wasRunning) this.start();
    else this.emit();
  }

  emit() {
    if (this.onChange) this.onChange(this.state());
  }
}

if (typeof module === 'object' && module.exports) module.exports = { Pomodoro };
else self.Pomodoro = Pomodoro;
