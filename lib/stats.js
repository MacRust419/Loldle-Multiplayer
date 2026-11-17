const fs = require("fs");
const STATS_FILE = "./data/stats.json";
let stats = require("../data/stats.json");

function saveStats() {
    fs.writeFileSync(
        STATS_FILE,
        JSON.stringify(stats, null, 2)
    );
}

function ensureStats(userId) {

    if (stats[userId]) return;

    stats[userId] = {
        single: {
            classic: { played: 0, wins: 0 },
            quote: { played: 0, wins: 0 },
            ability: { played: 0, wins: 0 },
            skin: { played: 0, wins: 0 }
        },
        multi: {
            classic: { played: 0, wins: 0 },
            quote: { played: 0, wins: 0 },
            ability: { played: 0, wins: 0 },
            skin: { played: 0, wins: 0 }
        }
    };
}

function recordWin(mode, winnerId, players) {

    if (
        !players.includes(
            winnerId
        )
    ) {
        return;
    }

    if (players.length === 0) {
        return;
    }

    const type =
        players.length === 1
            ? "single"
            : "multi";

    for (const playerId of players) {

        ensureStats(playerId);

        stats[playerId][type][mode]
            .played++;
    }

    stats[winnerId][type][mode]
        .wins++;

    saveStats();
}

function getLeaderboardStats(userStats, scope, mode) {

    let wins = 0;
    let played = 0;

    const scopes =
        scope === "both"
            ? ["single", "multi"]
            : [scope];

    const modes =
        mode === "all"
            ? ["classic", "quote", "ability", "skin"]
            : [mode];

    for (const s of scopes) {
        for (const m of modes) {

            wins += userStats[s][m].wins;
            played += userStats[s][m].played;
        }
    }

    return {
        wins,
        played,
        winRate:
            played === 0
                ? 0
                : wins / played * 100
    };
}

module.exports = {
    stats,
    saveStats,
    ensureStats,
    recordWin,
    getLeaderboardStats
};