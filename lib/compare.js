function display(arr) {
    return Array.isArray(arr) ? arr.join(', ') : String(arr);
}

function match(a, b) {
    return a === b ? '🟩' : '🟥';
}

function arrayMatch(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return '🟥';

    const hasOverlap = a.some(x => b.includes(x));

    if (!hasOverlap) return '🟥';

    if (a.length === b.length && a.every(x => b.includes(x))) {
        return '🟩';
    }

    return '🟨';
}

function compareYear(a, b) {
    if (a === b) return '🟩';
    return a < b ? '⬆️' : '⬇️';
}

module.exports = {
    display,
    match,
    arrayMatch,
    compareYear
};