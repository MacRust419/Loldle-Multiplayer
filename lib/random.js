const champions = require("../data/champions.json");
const quoteCache = require("../data/quoteCache.json");

function randomChampion() {
    const x = Math.floor(Math.random() * champions.length);
    console.log(champions[x].name);
    return champions[x];
}

function randomQuote(championName) {

    const quotes =
        quoteCache[championName.toLowerCase()];

    if (!quotes?.length) {
        return null;
    }

    const x =
        Math.floor(Math.random() * quotes.length);

    return quotes[x];
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
}