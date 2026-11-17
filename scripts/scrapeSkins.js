const fs = require("fs");

const champions = require("../data/champions.json");

async function versionExists(version) {

    const url =
        `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/Aatrox.json`;

    try {

        const res = await fetch(url);

        return res.ok;

    } catch {

        return false;
    }
}

async function findNewestVersion() {

    const VERSION = "16.19.1";

    let [major, minor] =
        VERSION
            .split(".")
            .slice(0, 2)
            .map(Number);

    let newest =
        `${major}.${minor}.1`;

    while (true) {

        const test =
            `${major}.${minor + 1}.1`;

        console.log(
            `Checking ${test}`
        );

        if (
            await versionExists(test)
        ) {

            newest = test;
            minor++;
            continue;
        }

        break;
    }

    while (true) {

        const test =
            `${major + 1}.1.1`;

        console.log(
            `Checking ${test}`
        );

        if (
            await versionExists(test)
        ) {

            major++;
            minor = 1;
            newest = test;

            while (true) {

                const next =
                    `${major}.${minor + 1}.1`;

                console.log(
                    `Checking ${next}`
                );

                if (
                    await versionExists(next)
                ) {

                    newest = next;
                    minor++;
                    continue;
                }

                break;
            }

            continue;
        }

        break;
    }

    return newest;
}

(async () => {

    const newestVersion =
        await findNewestVersion();

    console.log(
        `\nUsing version ${newestVersion}\n`
    );

    for (const champ of champions) {

        try {

            console.log(
                `Updating ${champ.name}`
            );

            const url =
                `https://ddragon.leagueoflegends.com/cdn/${newestVersion}/data/en_US/champion/${champ.id}.json`;

            const res =
                await fetch(url);

            if (!res.ok) {

                console.log(
                    `Failed: ${champ.name}`
                );

                continue;
            }

            const json =
                await res.json();

            const data =
                json.data?.[champ.id];

            if (!data?.skins) {

                console.log(
                    `No skins: ${champ.name}`
                );

                continue;
            }

            const existingNames =
                new Set(
                    champ.skins.map(
                        s => s.name
                    )
                );

            for (const skin of data.skins) {

                if (
                    "parentSkin" in skin
                ) {
                    continue;
                }

                if (
                    existingNames.has(
                        skin.name
                    )
                ) {
                    continue;
                }

                champ.skins.push({
                    name: skin.name,
                    url:
                        `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champ.id}_${skin.num}.jpg`
                });

                console.log(
                    `  + ${skin.name}`
                );
            }

        } catch (err) {

            console.log(
                `Failed: ${champ.name}`
            );

            console.error(err);
        }
    }

    fs.writeFileSync(
        "./data/champions.json",
        JSON.stringify(
            champions,
            null,
            4
        )
    );

    console.log(
        "\nDONE"
    );

})();