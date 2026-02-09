
/**
 * Utility for date handling in the RSI Project
 */

/**
 * Returns today's date in YYYY-MM-DD format for WITA (GMT+8) timezone.
 * Mataram follows WITA.
 */
export function getTodayWita(): string {
    const d = new Date();
    // WITA is UTC+8
    const witaDate = new Date(d.getTime() + (8 * 60 * 60 * 1000));
    return witaDate.toISOString().split('T')[0];
}

/**
 * Alternative using Intl (more robust but sometimes slower)
 */
export function getTodayFormatted(timeZone: string = 'Asia/Makassar'): string {
    const options: Intl.DateTimeFormatOptions = {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };

    const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA gives YYYY-MM-DD
    return formatter.format(new Date());
}

/**
 * Returns a Date object representing the start of today in WITA (00:00 WITA).
 * In UTC, this will be 16:00 of the previous day.
 */
export function getStartOfTodayWita(): Date {
    const todayStr = getTodayFormatted();
    // Create date from string with offset
    return new Date(`${todayStr}T00:00:00+08:00`);
}

/**
 * Returns a Date object representing the start of the current week (Sunday) in WITA.
 */
export function getStartOfWeekWita(): Date {
    const today = getStartOfTodayWita();
    const day = today.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = today.getDate() - day;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(diff);
    return startOfWeek;
}

/**
 * Returns a Date object representing the start of the current month in WITA.
 */
export function getStartOfMonthWita(): Date {
    const today = getStartOfTodayWita();
    const startOfMonth = new Date(today);
    startOfMonth.setDate(1);
    return startOfMonth;
}

/**
 * Formats a Date object to YYYY-MM-DD string in WITA
 */
export function formatWitaDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Makassar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(date);
}

/**
 * Returns current timestamp in HH:MM:SS format for WITA
 */
export function getCurrentTimeWita(): string {
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const formatter = new Intl.DateTimeFormat('en-GB', options); // en-GB gives HH:MM:SS
    return formatter.format(new Date());
}
