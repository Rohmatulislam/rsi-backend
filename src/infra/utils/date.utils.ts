
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
