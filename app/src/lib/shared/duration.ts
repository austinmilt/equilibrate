
export const HOURS_PER_DAY: number = 24.0;
export const MINUTES_PER_HOUR: number = 60.0;
export const SECONDS_PER_MINUTE: number = 60.0;
export const MILLISECONDS_PER_SECOND: number = 1000.0;
export const MILLISECONDS_PER_DAY: number =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
export const MILLISECONDS_PER_HOUR: number =
  MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
export const MILLISECONDS_PER_MINUTE: number = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE;

/**
 * This class represents a duration of time rather than
 * a point in time like Date. It is useful for making
 * easily-digestible durations to be passed in to other
 * methods. Use like
 *
 * ```
 * Duration.ofMinutes(3).asMilliseconds() // == 3000
 * Duration.ofMinutes(3).andSeconds(21).asHours() // ~= 0.05583333333
 * ```
 *
 * This should not be used where nanosecond precision is needed.
 */
export class Duration {
    private milliseconds: number = 0;

    private constructor(milliseconds: number) {
        this.milliseconds = milliseconds;
    }

    /**
   * @param days duration in days
   * @returns a new duration of length `days`
   */
    public static ofDays(days: number): Duration {
        return Duration.ofHours(days * HOURS_PER_DAY);
    }

    /**
   * @param hours duration in hours
   * @returns a new duration of length `hours`
   */
    public static ofHours(hours: number): Duration {
        return Duration.ofMinutes(hours * MINUTES_PER_HOUR);
    }

    /**
   * @param minutes duration in minutes
   * @returns a new duration of length `minutes`
   */
    public static ofMinutes(minutes: number): Duration {
        return Duration.ofSeconds(minutes * SECONDS_PER_MINUTE);
    }

    /**
   * @param seconds duration in seconds
   * @returns a new duration of length `seconds`
   */
    public static ofSeconds(seconds: number): Duration {
        return Duration.ofMilliseconds(seconds * MILLISECONDS_PER_SECOND);
    }

    /**
   * @param milliseconds duration in milliseconds
   * @returns a new duration of length `milliseconds`
   */
    public static ofMilliseconds(milliseconds: number): Duration {
        return new Duration(milliseconds);
    }

    /**
   * Adds the given duration to this instance
   *
   * @param days duration in days
   * @returns this duration
   */
    public andDays(days: number): Duration {
        this.andHours(days * HOURS_PER_DAY);
        return this;
    }

    /**
   * Adds the given duration to this instance
   *
   * @param hours duration in hours
   * @returns this duration
   */
    public andHours(hours: number): Duration {
        this.andMinutes(hours * MINUTES_PER_HOUR);
        return this;
    }

    /**
   * Adds the given duration to this instance
   *
   * @param minutes duration in minutes
   * @returns this duration
   */
    public andMinutes(minutes: number): Duration {
        this.andSeconds(minutes * SECONDS_PER_MINUTE);
        return this;
    }

    /**
   * Adds the given duration to this instance
   *
   * @param seconds duration in seconds
   * @returns this duration
   */
    public andSeconds(seconds: number): Duration {
        this.andMilliseconds(seconds * MILLISECONDS_PER_SECOND);
        return this;
    }

    /**
   * Adds the given duration to this instance
   *
   * @param milliseconds duration in milliseconds
   * @returns this duration
   */
    public andMilliseconds(milliseconds: number): Duration {
        this.milliseconds += milliseconds;
        return this;
    }

    /**
   * Adds the given duration to this instance
   *
   * @param other duration to add to this one
   * @returns this duration
   */
    public add(other: Duration): Duration {
        this.milliseconds += other.milliseconds;
        return this;
    }

    /**
   * @returns this duration in floating-point days
   */
    public asDays(): number {
        return this.asHours() / HOURS_PER_DAY;
    }

    /**
   * @returns this duration in floating-point hours
   */
    public asHours(): number {
        return this.asMinutes() / MINUTES_PER_HOUR;
    }

    /**
   * @returns this duration in floating-point minutes
   */
    public asMinutes(): number {
        return this.asSeconds() / SECONDS_PER_MINUTE;
    }

    /**
   * @returns this duration in floating-point seconds
   */
    public asSeconds(): number {
        return this.asMilliseconds() / MILLISECONDS_PER_SECOND;
    }

    /**
   * @returns this duration in floating-point milliseconds
   */
    public asMilliseconds(): number {
        return this.milliseconds;
    }

    /**
   * @returns whole-number of days of this duration, e.g. for a duration of
   * 2 days, 3 hours, 4 minutes, 5 seconds, 6 milliseconds this would return 2
   */
    public daysPart(): number {
        return Math.floor(this.milliseconds / MILLISECONDS_PER_DAY);
    }

    /**
   * @returns whole-number of hours of this duration, e.g. for a duration of 2
   * days, 3 hours, 4 minutes, 5 seconds, 6 milliseconds this would return 3
   */
    public hoursPart(): number {
        return Math.floor((this.milliseconds % MILLISECONDS_PER_DAY) / MILLISECONDS_PER_HOUR);
    }

    /**
   * @returns whole-number of minutes of this duration, e.g. for a duration of
   * 2 days, 3 hours, 4 minutes, 5 seconds, 6 milliseconds this would return 4
   */
    public minutesPart(): number {
        return Math.floor((this.milliseconds % MILLISECONDS_PER_HOUR) / MILLISECONDS_PER_MINUTE);
    }

    /**
   * @returns whole-number of seconds of this duration, e.g. for a duration of
   * 2 days, 3 hours, 4 minutes, 5 seconds, 6 milliseconds this would return 5
   */
    public secondsPart(): number {
        return Math.floor((this.milliseconds % MILLISECONDS_PER_MINUTE) / MILLISECONDS_PER_SECOND);
    }

    /**
   * @returns whole-number of milliseconds of this duration, e.g. for a duration of
   * 2 days, 3 hours, 4 minutes, 5 seconds, 6 milliseconds this would return 6
   */
    public millisecondsPart(): number {
        return Math.floor(this.milliseconds);
    }

    /**
   * Creates a new date that is now + this duration in the future.
   */
    public fromNow(): Date {
        return new Date(new Date().getTime() + this.milliseconds);
    }
}
