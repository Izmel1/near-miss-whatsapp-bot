function generateFolio(itemId, year = new Date().getFullYear()) {
    if ((typeof itemId !== "string" && typeof itemId !== "number") ||
        (typeof itemId === "string" && !/^\d+$/.test(itemId.trim())) ||
        !Number.isSafeInteger(Number(itemId)) || Number(itemId) <= 0) {
        throw new Error("Invalid SharePoint item ID: expected a positive integer");
    }
    if (!Number.isInteger(year) || year < 1000 || year > 9999) {
        throw new Error("Invalid folio year: expected a four-digit year");
    }
    const consecutive = String(Number(itemId)).padStart(5, "0");

    return `SEG-${year}-${consecutive}`;
}

module.exports = generateFolio;
