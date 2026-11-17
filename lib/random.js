const champions = require("../data/champions.json");
const quoteCache = require("../data/quoteCache.json");

function randomChampion() {
    return champions[Math.floor(Math.random() * champions.length)];
}

function randomQuote(championName) {
    const quotes = quoteCache[championName.toLowerCase()];

    if (!quotes?.length) {
        return null;
    }

    return quotes[Math.floor(Math.random() * quotes.length)];
}

function randomSkin(champion) {
    return champion.skins[
        Math.floor(Math.random() * champion.skins.length)
    ];
}

module.exports = {
    randomChampion,
    randomQuote,
    randomSkin
};
