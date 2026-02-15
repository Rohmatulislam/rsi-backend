/**
 * Utility to normalize and check SIMRS poliklinik names
 */

/**
 * Regex to identify keywords that should be cleaned or used for categorization
 * Includes common typos found in the system (e.g., "ekskutif")
 */
export const POLI_KEYWORDS_REGEX = /(poliklinik|poli|klinik|eksekutif|ekskutif|executive)/gi;

/**
 * Normalizes a poliklinik name by removing noise and standardizing casing
 * Example: "Poli Anak Eksekutif" -> "Anak Eksekutif"
 */
export function normalizePoliName(name: string): string {
    if (!name) return '';

    // Clean common prefixes and the executive keyword for a "base" name
    // But usually we want to keep "Eksekutif" in the name if it's there, 
    // just standardized.

    let normalized = name.replace(POLI_KEYWORDS_REGEX, (match) => {
        const lower = match.toLowerCase();
        if (lower.includes('eksekutif') || lower.includes('ekskutif') || lower.includes('executive')) {
            return 'Eksekutif';
        }
        return ''; // Remove "Poli", "Poliklinik", etc.
    });

    // Clean up whitespace and potential double spaces from removals
    return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Checks if a poliklinik name indicates an executive service
 */
export function isExecutive(name: string): boolean {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower.includes('eksekutif') ||
        lower.includes('ekskutif') ||
        lower.includes('executive');
}

/**
 * Formats a display name for a poliklinik
 * Ensures "Eksekutif" is used consistently instead of variations/typos
 */
export function formatDisplayPoliName(name: string): string {
    if (!name) return '';

    // Standardize "Eksekutif" variations
    let formatted = name.replace(/(eksekutif|ekskutif|executive)/gi, 'Eksekutif');

    // Ensure "Poli" prefix is consistent if that's the house style, 
    // or just return the standardized name.
    return formatted.trim();
}
