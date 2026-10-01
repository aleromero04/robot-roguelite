// Tracks displayed HP only; rejected hits and Shield blocks cannot trigger a loss.
export class HealthFeedback {
  private previous?: number
  private until = 0
  private color = 0

  update(health: number, now: number): number | undefined {
    if (this.previous !== undefined && health !== this.previous) {
      this.color = health < this.previous ? 0xff6578 : 0x64d98b
      this.until = now + 200
    }
    this.previous = health
    return now < this.until ? this.color : undefined
  }
}
