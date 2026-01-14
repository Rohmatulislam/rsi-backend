
// Mock of normalization and matching logic from frontend

const normalizeInpatientString = (str) => {
    if (!str) return "";
    const normalized = str.toLowerCase()
        .replace(/unit\s+/g, '')
        .replace(/gedung\s+/g, '')
        .replace(/r\.\s*/g, '')
        .replace(/by\.\s*/g, '')
        .replace(/by\s+/g, '')
        .replace(/bayi\s+/g, '')
        .replace(/ruang\s+/g, '')
        .replace(/kelas\s*/g, '')
        .replace(/[-\/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s+/g, '');

    if (normalized === 'i' || normalized === '1' || normalized === 'satu') return '1';
    if (normalized === 'ii' || normalized === '2' || normalized === 'dua') return '2';
    if (normalized === 'iii' || normalized === '3' || normalized === 'tiga') return '3';
    if (normalized === 'vvipsuite' || normalized === 'vvip') return 'vvip';

    return normalized;
};

const getAvailabilityFor = (availability, unitName, className) => {
    if (!availability) return undefined;
    const nUnit = normalizeInpatientString(unitName);
    const nClass = normalizeInpatientString(className);

    const matches = availability.filter(a => {
        const ab = normalizeInpatientString(a.unitName);
        const ac = normalizeInpatientString(a.class);
        return ab === nUnit && ac === nClass;
    });

    if (matches.length === 0) return undefined;
    return matches[0]; // Simplified for test
};

// Test Data
const serviceItems = [
    { category: "By. Safa", name: "Kelas 1", isActive: true },
    { category: "R. ICU", name: "Kelas Utama", isActive: true },
    { category: "R. Jabal Rahmah", name: "Kelas 1", isActive: true },
    { category: "R. Mina", name: "Kelas VIP", isActive: true },
    { category: "R.Arafah", name: "Kelas VIP", isActive: true }
];

const availability = [
    { unitName: "By. Safa", class: "Kelas 1", total: 2 },
    { unitName: "R. ICU", class: "Kelas Utama", total: 6 },
    { unitName: "R. Jabal Rahmah", class: "Kelas 1", total: 14 },
    { unitName: "R. Mina", class: "Kelas VIP", total: 7 },
    { unitName: "R.Arafah", class: "Kelas VIP", total: 12 }
];

console.log('Testing Normalization and Matching...');
serviceItems.forEach(item => {
    const avail = getAvailabilityFor(availability, item.category, item.name);
    console.log(`- Item: "${item.category}" | "${item.name}"`);
    console.log(`  Normalized: "${normalizeInpatientString(item.category)}" | "${normalizeInpatientString(item.name)}"`);
    if (avail) {
        console.log(`  MATCH FOUND: ${avail.unitName} | ${avail.class}`);
    } else {
        console.log(`  NO MATCH FOUND!`);
    }
});

// Test some edge cases
console.log('\nEdge Case Tests:');
const testCases = ["R.Arafah", "R. Arafah", "By. Safa", "By.Safa", "Kelas 1", "Kelas1"];
testCases.forEach(tc => {
    console.log(`"${tc}" -> "${normalizeInpatientString(tc)}"`);
});
