import type { DailyEntry, LocalDate } from "../domain/contracts";
import { listCalendarDates } from "./analysis";

export interface PlaybackOptions {
  startDate: LocalDate;
  endDate: LocalDate;
  speedMs?: number; // Default 1000ms
  onDateChange: (date: LocalDate) => void;
  onPlaybackEnd: () => void;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentDate: LocalDate;
  speedMs: number;
  dateList: LocalDate[];
  currentIndex: number;
  canPlay: boolean;
  prefetchedDates: Set<LocalDate>;
}

export class TimelinePlaybackController {
  private isPlaying = false;
  private currentDate: LocalDate;
  private speedMs: number;
  private dateList: LocalDate[];
  private currentIndex: number;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private currentRequestId = 0;
  private onDateChange: (date: LocalDate) => void;
  private onPlaybackEnd: () => void;
  private entriesByDate: Map<LocalDate, DailyEntry | null>;

  constructor(
    entries: readonly DailyEntry[],
    startDate: LocalDate,
    endDate: LocalDate,
    onDateChange: (date: LocalDate) => void,
    onPlaybackEnd: () => void,
    speedMs = 1000
  ) {
    this.dateList = listCalendarDates(startDate, endDate);
    this.currentDate = this.dateList[0] ?? startDate;
    this.currentIndex = 0;
    this.onDateChange = onDateChange;
    this.onPlaybackEnd = onPlaybackEnd;
    this.speedMs = speedMs;

    this.entriesByDate = new Map();
    for (const entry of entries) {
      this.entriesByDate.set(entry.localDate, entry);
    }
  }

  public getRecordedEntryCount(): number {
    return Array.from(this.entriesByDate.values()).filter(e => e !== null).length;
  }

  public canPlayback(): boolean {
    return this.getRecordedEntryCount() >= 2;
  }

  public getPrefetchWindow(size = 3): LocalDate[] {
    const window: LocalDate[] = [];
    for (let i = this.currentIndex; i < Math.min(this.dateList.length, this.currentIndex + size); i++) {
      window.push(this.dateList[i]);
    }
    return window;
  }

  public play(): boolean {
    if (!this.canPlayback()) return false;
    if (this.isPlaying) return true;

    // If at end of range, restart from beginning
    if (this.currentIndex >= this.dateList.length - 1) {
      this.currentIndex = 0;
      this.currentDate = this.dateList[0];
      this.onDateChange(this.currentDate);
    }

    this.isPlaying = true;
    this.scheduleNextStep();
    return true;
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public setSpeed(speedMs: number): void {
    this.speedMs = speedMs;
    if (this.isPlaying) {
      if (this.timerId !== null) clearTimeout(this.timerId);
      this.scheduleNextStep();
    }
  }

  public seek(date: LocalDate): number {
    // Scrubbing cancels active playback and stale loads
    this.pause();
    this.currentRequestId++; // Bump token to cancel any in-flight async loads

    const idx = this.dateList.indexOf(date);
    if (idx !== -1) {
      this.currentIndex = idx;
      this.currentDate = date;
      this.onDateChange(date);
    }
    return this.currentRequestId;
  }

  public stepForward(): void {
    this.pause();
    if (this.currentIndex < this.dateList.length - 1) {
      this.currentIndex++;
      this.currentDate = this.dateList[this.currentIndex];
      this.onDateChange(this.currentDate);
    }
  }

  public stepBackward(): void {
    this.pause();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.currentDate = this.dateList[this.currentIndex];
      this.onDateChange(this.currentDate);
    }
  }

  public dispose(): void {
    this.pause();
    this.currentRequestId++;
  }

  private scheduleNextStep(): void {
    if (!this.isPlaying) return;

    this.timerId = setTimeout(() => {
      if (!this.isPlaying) return;

      if (this.currentIndex < this.dateList.length - 1) {
        this.currentIndex++;
        this.currentDate = this.dateList[this.currentIndex];
        this.onDateChange(this.currentDate);
        this.scheduleNextStep();
      } else {
        // Reached end of range: stop cleanly
        this.isPlaying = false;
        this.timerId = null;
        this.onPlaybackEnd();
      }
    }, this.speedMs);
  }
}
