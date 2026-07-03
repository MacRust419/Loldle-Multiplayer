const fs = require("fs");
const path = require("path");

const champions = require("../data/champions.json");

const OUTPUT = path.join(
    __dirname,
    "..",
    "data",
    "quoteCache.json"
);
const existingCache = fs.existsSync(OUTPUT)
    ? JSON.parse(fs.readFileSync(OUTPUT, "utf8"))
    : {};
const cache = { ...existingCache };

function wikiName(name) {
    return name
        .replace(/ /g, "_")
        .replace(/'/g, "%27")
        .replace("_&_Willump", "");
}

async function fetchAudioPage(champion) {

    const page = `${wikiName(champion)}/LoL/Audio`;

    const url =
        `https://leagueoflegends.fandom.com/api.php` +
        `?action=parse` +
        `&page=${page}` +
        `&prop=text` +
        `&formatversion=2` +
        `&format=json`;

    const res = await fetch(url);
    const data = await res.json();

    return data.parse?.text || "";
}

(async () => {

    for (const champ of champions) {

        const key = champ.name.toLowerCase();

        if (cache[key]?.length) {
            console.log(`Skipping ${champ.name}`);
            continue;
        }

        console.log(`\n=== ${wikiName(champ.name)} ===`);

        try {

            let html = await fetchAudioPage(champ.name);

            if (!html) {
                console.log("No page");
                continue;
            }

            const triviaPos = html.indexOf("Trivia");
            const sfxPos = html.indexOf("Sound Effects");

            let cutPos = html.length;

            if (triviaPos !== -1) {
                cutPos = Math.min(cutPos, triviaPos);
            }

            if (sfxPos !== -1) {
                cutPos = Math.min(cutPos, sfxPos);
            }

            html = html.slice(0, cutPos);

            const quotes = [];

            const champToken =
                "/" + wikiName(champ.name).toLowerCase();

            let pos = 0;

            while (true) {

                const audioStart = html.indexOf(
                    'href="https://static.wikia.nocookie.net/',
                    pos
                );

                if (audioStart === -1) {
                    break;
                }

                const urlStart = audioStart + 6;

                const audioEnd = html.indexOf(
                    '"',
                    urlStart
                );

                if (audioEnd === -1) {
                    break;
                }

                const audio = html.slice(
                    urlStart,
                    audioEnd
                );

                pos = audioEnd;

                if (!audio.includes(".ogg")) {
                    continue;
                }

                if (
                    !audio
                        .toLowerCase()
                        .includes(champToken)
                ) {
                    continue;
                }

                if (
                    !audio.includes("Original") &&
                    !audio.includes("Select") &&
                    !audio.includes("Ban")
                ) {
                    continue;
                }

                const italicStart =
                    html.indexOf("<i>", pos);

                if (italicStart === -1) {
                    continue;
                }

                const italicEnd =
                    html.indexOf(
                        "</i>",
                        italicStart
                    );

                if (italicEnd === -1) {
                    continue;
                }

                pos = italicEnd;

                const italicText = html
                    .slice(
                        italicStart + 3,
                        italicEnd
                    )
                    .trim();

                if (
                    italicText.includes(
                        "basic-tooltip"
                    )
                ) {
                    continue;
                }

                const cleanText = italicText
                    .replace(
                        /<[^>]+>/g,
                        ""
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

                const matches =
                    [...cleanText.matchAll(
                        /"([^"]+)"/g
                    )];

                if (matches.length === 0) {
                    continue;
                }

                let quote = matches
                    .map(m => m[1])
                    .join(" ")
                    .trim();

                if (
                    quote.split(/\s+/).length < 3
                ) {
                    continue;
                }

                quotes.push({
                    text: quote,
                    audio
                });
            }

            cache[key] = quotes;

            console.log(
                `Saved ${quotes.length} quotes`
            );

        } catch (err) {

            console.log(
                `FAILED: ${champ.name}`
            );

            console.error(err);
        }
    }

    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(cache, null, 2)
    );

    console.log("\nDONE");
})();