const DAY = 86_400_000;

export function parseDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        value.startsWith('0000') ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
    ) {
        throw new RangeError('Data inválida. Use YYYY-MM-DD.');
    }
    return date;
}

export function dateString(date: Date): string {
    return date.toISOString().slice(0, 10);
}
export function timeString(time: Date | null): string | null {
    return time?.toISOString().slice(11, 16) ?? null;
}
export function parseTime(value: string | null | undefined): Date | null {
    return value == null ? null : new Date(`1970-01-01T${value}:00.000Z`);
}
export function addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * DAY);
}
export function daysBetween(start: Date, end: Date): number {
    return Math.round((end.getTime() - start.getTime()) / DAY);
}
export function validDateString(value: string): boolean {
    try {
        parseDate(value);
        return true;
    } catch {
        return false;
    }
}
export function today(timezone: string, now = new Date()): Date {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const part = (name: string) => parts.find((entry) => entry.type === name)!.value;
    return parseDate(`${part('year')}-${part('month')}-${part('day')}`);
}

export function clampedDate(year: number, month: number, day: number): Date | null {
    if (year < 1 || year > 9999) return null;
    const last = new Date(0);
    last.setUTCFullYear(year, month + 1, 0);
    const result = new Date(0);
    result.setUTCFullYear(year, month, Math.min(day, last.getUTCDate()));
    return result;
}
