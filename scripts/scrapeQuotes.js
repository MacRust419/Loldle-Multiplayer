const fs = require("fs");
const path = require("path");

const champions = require("../data/champions.json");

const OUTPUT = path.join(
    __dirname,
    "..",
    "data",
    "quoteCache.json"
);

// The League of Legends Wiki moved from Fandom to wiki.gg and now lives at
// wiki.leagueoflegends.com (actively maintained). It is still a MediaWiki, so
// the parse API works the same way; the audio pages and file hosting differ.
const WIKI_HOST = "https://wiki.leagueoflegends.com";
const API = `${WIKI_HOST}/en-us/api.php`;

const existingCache = fs.existsSync(OUTPUT)
    ? JSON.parse(fs.readFileSync(OUTPUT, "utf8"))
    : {};
const cache = { ...existingCache };

// Champion display name -> wiki page title.
function wikiName(name) {
    return name
        .replace(/ /g, "_")
        .replace("_&_Willump", "");
}

// Decode the handful of HTML entities that turn up in quote text and
// file titles on the wiki.
function decodeEntities(str) {
    return str
        .replace(/&quot;/g, '"')
        .replace(/&#0*39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
}

async function fetchAudioPage(championPage) {

    const url =
        `${API}` +
        `?action=parse` +
        `&page=${encodeURIComponent(championPage)}` +
        `&prop=text` +
        `&redirects=1` +
        `&formatversion=2` +
        `&format=json`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
        return "";
    }

    return data.parse?.text || "";
}

// Pull the direct .ogg URL out of a single <audio> element. The wiki lists the
// playable .ogg source first and an .mp3 transcode second; we want the .ogg and
// build an absolute URL from the relative src.
function audioSource(audioBlock) {

    const sources = [...audioBlock.matchAll(
        /<source\b[^>]*\bsrc="([^"]+)"/g
    )];

    for (const s of sources) {

        const src = s[1];

        if (!src.includes(".ogg") || src.includes("/transcoded/")) {
            continue;
        }

        return src.startsWith("http")
            ? src
            : WIKI_HOST + src;
    }

    return null;
}

// Drop everything from the "Trivia" and "Sound Effects" sections onward. Those
// sections re-list audio clips next to unrelated prose, which would otherwise
// get mis-paired with a clip. Matches the original scraper's cut-off intent.
function trimToVoiceLines(html) {

    const triviaPos = html.indexOf('id="Trivia"');
    const sfxPos = html.indexOf('id="Sound_Effects"');

    let cutPos = html.length;

    if (triviaPos !== -1) {
        cutPos = Math.min(cutPos, triviaPos);
    }

    if (sfxPos !== -1) {
        cutPos = Math.min(cutPos, sfxPos);
    }

    return html.slice(0, cutPos);
}

// Extract a spoken line from the <i>...</i> that follows an audio clip, but
// only within that clip's own list item (bounded by `limit`) so a clip without
// a line of its own never borrows the next item's.
function quoteFromItalic(html, fromPos, limit) {

    const italicStart = html.indexOf("<i>", fromPos);

    if (italicStart === -1 || italicStart >= limit) {
        return null;
    }

    const italicEnd = html.indexOf("</i>", italicStart);

    if (italicEnd === -1 || italicEnd > limit) {
        return null;
    }

    const cleanText = decodeEntities(
        html
            .slice(italicStart + 3, italicEnd)
            .replace(/<[^>]+>/g, "")
    )
        .replace(/\s+/g, " ")
        .trim();

    const matches = [...cleanText.matchAll(/"([^"]+)"/g)];

    if (matches.length === 0) {
        return null;
    }

    const quote = matches
        .map(m => m[1])
        .join(" ")
        .trim();

    if (quote.split(/\s+/).length < 3) {
        return null;
    }

    return quote;
}

// Walk the audio clips on a champion's page in order. Each clip carries a
// data-mwtitle such as "Aatrox_Original_Taunt_0.ogg"; we keep the base
// ("Original") voice lines plus the champion-select ("Select") and ban
// ("Ban") lines, and pair each with the spoken line that follows it. Skin
// recordings and sound effects are skipped, and each clip is kept only once.
function parseQuotes(html) {

    html = trimToVoiceLines(html);

    const quotes = [];
    const seen = new Set();

    const audioRe =
        /<audio\b[^>]*\bdata-mwtitle="([^"]*)"[\s\S]*?<\/audio>/g;

    let match;

    while ((match = audioRe.exec(html)) !== null) {

        const title = match[1];

        if (
            !title.includes("_Original") &&
            !title.includes("_Select") &&
            !title.includes("_Ban")
        ) {
            continue;
        }

        const audio = audioSource(match[0]);

        if (!audio || seen.has(audio)) {
            continue;
        }

        const liEnd = html.indexOf("</li>", audioRe.lastIndex);
        const limit = liEnd === -1 ? html.length : liEnd;

        const quote = quoteFromItalic(html, audioRe.lastIndex, limit);

        if (!quote) {
            continue;
        }

        seen.add(audio);

        quotes.push({
            text: quote,
            audio
        });
    }

    return quotes;
}

(async () => {

    for (const champ of champions) {

        const key = champ.name.toLowerCase();

        if (cache[key]?.length) {
            console.log(`Skipping ${champ.name}`);
            continue;
        }

        const page = `${wikiName(champ.name)}/Audio`;

        console.log(`\n=== ${page} ===`);

        try {

            const html = await fetchAudioPage(page);

            if (!html) {
                console.log("No page");
                continue;
            }

            const quotes = parseQuotes(html);

            cache[key] = quotes;

            console.log(`Saved ${quotes.length} quotes`);

        } catch (err) {

            console.log(`FAILED: ${champ.name}`);

            console.error(err);
        }
    }

    fs.writeFileSync(
        OUTPUT,
        JSON.stringify(cache, null, 2)
    );

    console.log("\nDONE");
})();
