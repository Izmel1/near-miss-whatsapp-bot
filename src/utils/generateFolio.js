function generateFolio(itemId) {
    const year = new Date().getFullYear();
    const consecutive = String(itemId).padStart(5, "0");

    return `SEG-${year}-${consecutive}`;
}

module.exports = generateFolio;
