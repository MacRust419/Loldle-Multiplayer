const fs = require('fs');
require('dotenv').config();

const prism = require("prism-media");
const ffmpeg = require("ffmpeg-static");
prism.FFmpeg.getInfo = () => ({
    command: ffmpeg
});

const {
    Client,
    ChannelType,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes
} = require('discord.js');

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    VoiceConnectionStatus,
    StreamType,
    entersState
} = require('@discordjs/voice');

const {
    randomChampion,
    randomQuote,
    randomSkin
} = require("./lib/random");

const {
    display,
    match,
    arrayMatch,
    compareYear
} = require("./lib/compare");

const {
    createAbilityImage,
    getSkinHintConfig,
    createSkinImage
} = require("./lib/images");

const {
    stats,
    saveStats,
    ensureStats,
    recordWin,
    getLeaderboardStats
} = require("./lib/stats");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const missingConfig = ["TOKEN", "CLIENT_ID", "GUILD_ID"]
    .filter(name => !process.env[name]);

if (missingConfig.length) {
    console.error(`Missing required environment variables: ${missingConfig.join(", ")}`);
    process.exit(1);
}

const champions = require('./data/champions.json');
const SETTINGS_FILE = "./data/settings.json";
let settings = fs.existsSync(SETTINGS_FILE)
    ? JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"))
    : {};

const championMap = new Map(
    champions.map(c => [c.name.toLowerCase(), c])
);

const activeGames = new Map();
const activePlayers = new Set();

setInterval(() => {
    activePlayers.clear();
    console.log("Active player list cleared (1h reset)");
}, 60 * 60 * 1000);

function addActivePlayer(userId) {
    activePlayers.add(userId);
}

function saveSettings() {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

const commands = [
    new SlashCommandBuilder()
        .setName('loldle')
        .setDescription('Start a Loldle game')
        .addSubcommand(sub =>
            sub
                .setName('stats')
                .setDescription('Show player statistics')
                .addUserOption(opt =>
                    opt
                        .setName('user')
                        .setDescription('User')
                        .setRequired(false)
                )
        )   
        .addSubcommand(sub =>
            sub
                .setName('zreset')
                .setDescription('Reset your stats')
        )
        .addSubcommand(sub =>
            sub.setName('setchannel')
                .setDescription('Set default voice channel')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Voice channel')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('board')
                .setDescription('Show leaderboard')
                .addStringOption(opt =>
                    opt
                        .setName('scope')
                        .setDescription('Single, multi, or both')
                        .addChoices(
                            { name: 'Both', value: 'both' },
                            { name: 'Single', value: 'single' },
                            { name: 'Multi', value: 'multi' }
                        )
                )
                .addStringOption(opt =>
                    opt
                        .setName('mode')
                        .setDescription('Game mode')
                        .addChoices(
                            { name: 'All', value: 'all' },
                            { name: 'Classic', value: 'classic' },
                            { name: 'Quote', value: 'quote' },
                            { name: 'Ability', value: 'ability' },
                            { name: 'Skin', value: 'skin' }
                        )
                )
                .addStringOption(opt =>
                    opt
                        .setName('sort')
                        .setDescription('Sort by')
                        .addChoices(
                            { name: 'Wins', value: 'wins' },
                            { name: 'Games', value: 'games' },
                            { name: 'Win Rate', value: 'winrate' }
                        )
                )
                .addIntegerOption(opt =>
                    opt
                        .setName('top')
                        .setDescription('How many players')
                        .setMinValue(1)
                        .setMaxValue(20)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('leave')
                .setDescription('Leave the active player list')
        )

        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription('Show active players')
        )
        .addSubcommand(sub =>
            sub
                .setName('classic')
                .setDescription('Start Classic mode')
        )   
        .addSubcommand(sub =>
            sub
                .setName('ability')
                .setDescription('Start Ability mode')
        )
        .addSubcommand(sub =>
            sub.setName('quote')
                .setDescription('Start Quote mode')
        )
        .addSubcommand(sub =>
            sub
                .setName('skin')
                .setDescription('Start Skin mode')
        ),

    new SlashCommandBuilder()
        .setName('g')
        .setDescription('Guess a champion')
        .addStringOption(opt =>
            opt
                .setName('champion')
                .setDescription('Champion name')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    new SlashCommandBuilder()
        .setName('ff')
        .setDescription('Reveal answer'),

    new SlashCommandBuilder()
        .setName('hint')
        .setDescription('Give hints')
].map(c => c.toJSON());

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});
client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {

    if (interaction.isAutocomplete()) {

        const focused = interaction.options.getFocused().toLowerCase();

        const results = champions
            .filter(champ =>
                champ.name.toLowerCase().startsWith(focused)
            )
            .slice(0, 1)
            .map(champ => ({
                name: champ.name,
                value: champ.name
            }));

        return interaction.respond(results);
    }

    if (!interaction.isChatInputCommand()) return;

    const channelId = interaction.channelId;

    if (interaction.commandName === 'loldle') {

        const mode = interaction.options.getSubcommand();

        if (mode === 'setchannel') {

            const channel = interaction.options.getChannel('channel');

            if (!channel || channel.type !== ChannelType.GuildVoice) {
                return interaction.reply({
                    content: 'Select a valid voice channel.',
                    ephemeral: true
                });
            }

            settings[interaction.guildId] = channel.id;
            saveSettings();

            return interaction.reply(`Default voice channel set.`);
        }

        if (mode === "board") {

            const scope =
                interaction.options.getString("scope")
                ?? "both";

            const gameMode =
                interaction.options.getString("mode")
                ?? "all";

            const sort =
                interaction.options.getString("sort")
                ?? "wins";

            const top =
                interaction.options.getInteger("top")
                ?? 3;

            const rows = [];

            for (const [userId, userStats] of Object.entries(stats)) {

                const data =
                    getLeaderboardStats(
                        userStats,
                        scope,
                        gameMode
                    );

                if (sort === "winrate" && data.played < 5) {
                    continue;
                }

                rows.push({
                    userId,
                    ...data
                });
            }

            rows.sort((a, b) => {

                if (sort === "wins") {
                    return b.wins - a.wins;
                }

                if (sort === "games") {
                    return b.played - a.played;
                }

                return b.winRate - a.winRate;
            });

            const medals = ["🥇", "🥈", "🥉"];

            const lines = [];

            for (
                let i = 0;
                i < Math.min(rows.length, top);
                i++
            ) {

                const row = rows[i];

                const medal =
                    medals[i] ?? `${i + 1}.`;

                let name;

                try {

                    const member =
                        await interaction.guild.members.fetch(
                            row.userId
                        );

                    name = member.displayName;

                } catch {

                    name = row.userId;
                }

                if (sort === "winrate") {

                    lines.push(
                        `${medal} ${name} ${row.winRate.toFixed(1)}% (${row.wins}W/${row.played}G)`
                    );

                } else {

                    lines.push(
                        `${medal} ${name} ${row.wins}W/${row.played}G (${row.winRate.toFixed(1)}%)`
                    );
                }
            }

            const myIndex =
                rows.findIndex(
                    r => r.userId === interaction.user.id
                );

            let myRankText = "";

            if (myIndex !== -1) {

                const me = rows[myIndex];

                if (sort === "winrate") {

                    myRankText =
                        `\n\nYour Rank: #${myIndex + 1} • ${me.winRate.toFixed(1)}% (${me.wins}W/${me.played}G)`;
                } else {

                    myRankText =
                        `\n\nYour Rank: #${myIndex + 1} • ${me.wins}W/${me.played}G (${me.winRate.toFixed(1)}%)`;
                }
            }

            return interaction.reply(
                `🏆 ${scope.charAt(0).toUpperCase() + scope.slice(1)} • ${gameMode.charAt(0).toUpperCase() + gameMode.slice(1)} • ${sort}

                ${lines.join("\n")}${myRankText}`
            );
        }

        if (mode === "stats") {

            const user =
                interaction.options.getUser("user")
                ?? interaction.user;

            ensureStats(user.id);

            const s = stats[user.id];

            const wr = data =>
                data.played === 0
                    ? "0.0"
                    : ((data.wins / data.played) * 100).toFixed(1);

            const line = mode =>
                `${mode.wins}W/${mode.played}G (${wr(mode)}%)`;

            return interaction.reply(
                `## ${user.username}

                **Single**
                Classic • ${line(s.single.classic)}
                Quote • ${line(s.single.quote)}
                Ability • ${line(s.single.ability)}
                Skin • ${line(s.single.skin)}

                **Multi**
                Classic • ${line(s.multi.classic)}
                Quote • ${line(s.multi.quote)}
                Ability • ${line(s.multi.ability)}
                Skin • ${line(s.multi.skin)}`
            );
        }

        if (mode === "zreset") {

            delete stats[interaction.user.id];

            saveStats();

            return interaction.reply(
                "Your stats have been reset."
            );
        }

        if (mode === "leave") {

            const game = activeGames.get(channelId);

            if (
                game &&
                game.hostId === interaction.user.id
            ) {
                return interaction.reply({
                    content: "The game host cannot leave.",
                    ephemeral: true
                });
            }

            activePlayers.delete(
                interaction.user.id
            );

            return interaction.reply(
                "You left the active player list."
            );
        }

        if (mode === "list") {

            if (activePlayers.size === 0) {
                return interaction.reply(
                    "No active players."
                );
            }

            const players =
                [...activePlayers]
                    .map(id => {
                        const member =
                            interaction.guild.members.cache.get(id);

                        return member
                            ? member.displayName
                            : "Unknown";
                    })
                    .join("\n");

            return interaction.reply(
                `## Active Players\n${players}`
            );
        }

        if (mode === 'classic') {

            if (activeGames.has(channelId)) {
                return interaction.reply({
                    content: 'Game already running in this channel.',
                    ephemeral: true
                });
            }

            addActivePlayer(interaction.user.id);
            const answer = randomChampion();

            activeGames.set(interaction.channelId, {
                mode: 'classic',
                answer,
                guesses: new Set(),
                ffVotes: new Set(),
                hostId: interaction.user.id
            });

            return interaction.reply('Classic Loldle started. Use /g to guess.');
        }

        if (mode === "quote") {

            await interaction.deferReply();

            if (activeGames.has(channelId)) {
                return interaction.editReply({
                    content: 'Game already running in this channel.',
                    ephemeral: true
                });
            }

            addActivePlayer(interaction.user.id);
            const answer = randomChampion();

            const quoteData = randomQuote(answer.name);

            if (!quoteData) {
                return interaction.editReply({
                    content: `No quote found for ${answer.name}.`,
                    ephemeral: true
                });
            }

            activeGames.set(interaction.channelId, {
                mode: "quote",
                answer,
                audio: quoteData.audio,
                hintLevel: 0,
                guesses: new Set(),
                ffVotes: new Set(),
                hostId: interaction.user.id
            });

            return interaction.editReply(
                `### Quote\n> ${quoteData.text}`
            );
        }

        if (mode === "ability") {

            await interaction.deferReply();

            if (activeGames.has(channelId)) {
                return interaction.editReply({
                    content: 'Game already running in this channel.',
                    ephemeral: true
                });
            }

            activeGames.set(channelId, {
                loading: true
            });

            addActivePlayer(interaction.user.id);
            const answer = randomChampion();

            const abilities = answer.abilities;

            const ability =
                abilities[
                Math.floor(
                    Math.random() * abilities.length
                )
                ];

            const rotation =
                Math.floor(
                    Math.random() * 360
                );

            let image;

            try {
                image = await createAbilityImage(ability.url, 0, rotation);
            } catch (error) {
                activeGames.delete(channelId);
                console.error("Failed to load ability image:", error);

                return interaction.editReply({
                    content: "Could not load the ability image. Try again.",
                    ephemeral: true
                });
            }

            activeGames.set(channelId, {
                mode: "ability",
                answer,
                ability,
                rotation,
                hintLevel: 0,
                guesses: new Set(),
                ffVotes: new Set(),
                hostId: interaction.user.id
            });

            return interaction.editReply({
                content:
                    "Ability mode started. Guess with /g.",
                files: [{
                    attachment: image,
                    name: "ability.png"
                }]
            });
        }

        if (mode === 'skin') {
            await interaction.deferReply();

            if (activeGames.has(channelId)) {
                return interaction.editReply({
                    content: 'Game already running in this channel.',
                    ephemeral: true
                });
            }

            const answer = randomChampion();
            const skin = randomSkin(answer);
            const { size, forbidden } = getSkinHintConfig(0);
            let image;

            try {
                image = await createSkinImage(skin.url, size, forbidden);
            } catch (error) {
                console.error("Failed to load skin image:", error);

                return interaction.editReply({
                    content: "Could not load the skin image. Try again.",
                    ephemeral: true
                });
            }

            addActivePlayer(interaction.user.id);

            activeGames.set(channelId, {
                mode: "skin",
                answer,
                skin,
                hintLevel: 0,
                guesses: new Set(),
                ffVotes: new Set(),
                hostId: interaction.user.id
            });

            return interaction.editReply({
                content: "Skin mode started. Guess the champion with /g.",
                files: [{
                    attachment: image,
                    name: "skin.png"
                }]
            });
        }

    }

    if (interaction.commandName === 'ff') {

        const game = activeGames.get(channelId);

        if (!game) {
            return interaction.reply({
                content: 'No active game.',
                ephemeral: true
            });
        }

        if (
            !activePlayers.has(
                interaction.user.id
            )
        ) {
            return interaction.reply({
                content:
                    'You are not an active player.',
                ephemeral: true
            });
        }

        game.ffVotes.add(
            interaction.user.id
        );

        const needed =
            Math.floor(
                activePlayers.size / 2
            ) + 1;

        if (
            game.ffVotes.size >= needed
        ) {

            if (game.connection) {
                game.connection.destroy();
            }

            activeGames.delete(channelId);

            return interaction.reply(
                `FF passed (${game.ffVotes.size}/${activePlayers.size})\nAnswer was **${game.answer.name}**`
            );
        }

        const voters =
            [...game.ffVotes]
                .map(id => {
                    const member =
                        interaction.guild.members.cache.get(id);

                    return member
                        ? member.displayName
                        : "Unknown";
                })
                .join(', ');

        return interaction.reply(
            `FF vote: ${game.ffVotes.size}/${needed}\nVoted: ${voters}`
        );
    }

    if (interaction.commandName === 'hint') {

        await interaction.deferReply();
        const game = activeGames.get(channelId);

        if (!game) {
            return interaction.editReply({
                content: 'No active game.',
                ephemeral: true
            });
        }

        addActivePlayer(interaction.user.id);

        if (game.mode === "quote") {

            const voiceChannelId = settings[interaction.guildId];

            if (!voiceChannelId) {
                return interaction.editReply({
                    content: "No default voice channel set.",
                    ephemeral: true
                });
            }

            const guild = interaction.guild;

            if (!guild) {
                return interaction.editReply({
                    content: "Guild not available.",
                    ephemeral: true
                });
            }

            const channel = await guild.channels.fetch(voiceChannelId);

            if (!channel || channel.type !== ChannelType.GuildVoice) {
                return interaction.editReply({
                    content: "Configured voice channel is invalid.",
                    ephemeral: true
                });
            }

            try {

                if (!game.connection) {

                    game.connection = joinVoiceChannel({
                        channelId: channel.id,
                        guildId: guild.id,
                        adapterCreator: guild.voiceAdapterCreator
                    });

                    await entersState(
                        game.connection,
                        VoiceConnectionStatus.Ready,
                        10000
                    );

                    game.player = createAudioPlayer();

                    game.connection.subscribe(game.player);
                }

                const resource = createAudioResource(
                    game.audio,
                    { inputType: StreamType.Arbitrary }
                );

                game.player.play(resource);

                if (!game.quoteHintLevel) {
                    game.quoteHintLevel = 0;
                }

                game.quoteHintLevel++;

                if (game.quoteHintLevel === 1) {

                    return interaction.editReply({
                        content: "Playing quote..."
                    });
                }

                if (!game.revealedHints) {
                    game.revealedHints = [];
                }

                const possibleHints = [
                    { label: "Gender", value: game.answer.gender },
                    { label: "Resource", value: game.answer.resource },
                    { label: "Attack Type", value: display(game.answer.attackType) },
                    { label: "Position", value: display(game.answer.positions) },
                    { label: "Region", value: display(game.answer.regions) },
                    { label: "Species", value: display(game.answer.species) }
                ].filter(
                    h => !game.revealedHints.includes(h.label)
                );

                if (possibleHints.length === 0) {

                    return interaction.editReply({
                        content: "Playing quote..."
                    });
                }

                const hint =
                    possibleHints[
                    Math.floor(
                        Math.random() * possibleHints.length
                    )
                    ];

                game.revealedHints.push(hint.label);

                return interaction.editReply({
                    content:
                        `Playing quote\n` +
                        `**${hint.label}**: ${hint.value}`
                });

            } catch (err) {

                console.error("Quote hint error:", err);

                return interaction.editReply({
                    content: "Failed to play quote.",
                    ephemeral: true
                });
            }
        }

        if (game.mode === "ability") {

            if (game.hintLevel >= 2) {
                return interaction.editReply({
                    content:
                        "All hints already used."
                });
            }

            game.hintLevel++;

            const image =
                await createAbilityImage(
                    game.ability.url,
                    game.hintLevel,
                    game.rotation
                );

            const text =
                game.hintLevel === 1
                    ? "Rotation removed."
                    : "Original image revealed.";

            return interaction.editReply({
                content: text,
                files: [{
                    attachment: image,
                    name: "ability.png"
                }]
            });
        }

        if (game.mode === "skin") {

            if (game.hintLevel >= 9) {
                return interaction.editReply({
                    content: "Max hints reached."
                });
            }

            game.hintLevel++;

            const { size, forbidden } =
                getSkinHintConfig(game.hintLevel);

            const image = await createSkinImage(
                game.skin.url,
                size,
                forbidden
            );

            return interaction.editReply({
                content: `Hint ${game.hintLevel}`,
                files: [{
                    attachment: image,
                    name: "skin.png"
                }]
            });
        }

        return interaction.editReply({
            content: 'no hint available.'
        })
    }

    if (interaction.commandName === 'g') {

        const game = activeGames.get(channelId);

        if (!game) {
            return interaction.reply({
                content: 'Trễ 1 nhịp.'
            });
        }

        addActivePlayer(interaction.user.id);
        const input = interaction.options.getString('champion');
        const guess = championMap.get(input.toLowerCase());

        if (!guess) {
            return interaction.reply({
                content: `Who tf is ${input} .`,
            });
        }

        if (game.guesses.has(guess.id)) {
            return interaction.reply({
                content: `Already guessed ${guess.name}.`,
            });
        }

        game.guesses.add(guess.id);

        const answer = game.answer;

        if (guess.id === answer.id) {


            recordWin(
                game.mode,
                interaction.user.id,
                [...activePlayers]
            );

            activeGames.delete(channelId);

            if (game.connection) {
                game.connection.destroy();
            }

            if (game.mode === "skin") {

                return interaction.reply({
                    content:
                        `Correct! ${interaction.user.username} won.\n` +
                        `Champion: **${answer.name}**\n` +
                        `Skin: **${game.skin.name}**`,
                    files: [
                        game.skin.url
                    ]
                });
            }

            return interaction.reply(
                `Correct! ${interaction.user.username} won.\nAnswer: **${answer.name}**`
            );
        }
        if (game.mode !== 'classic') return interaction.reply(`**${guess.name}** is incorrect.`);

        const result =
            `## ${guess.name}

            Gender: ${display(guess.gender)} ${match(guess.gender, answer.gender)}
            Position: ${display(guess.positions)} ${arrayMatch(guess.positions, answer.positions)}
            Species: ${display(guess.species)} ${arrayMatch(guess.species, answer.species)}
            Resource: ${display(guess.resource)} ${match(guess.resource, answer.resource)}
            Attack: ${display(guess.attackType)} ${arrayMatch(guess.attackType, answer.attackType)}
            Region: ${display(guess.regions)} ${arrayMatch(guess.regions, answer.regions)}
            Year: ${guess.releaseYear} ${compareYear(guess.releaseYear, answer.releaseYear)}`;

        return interaction.reply(result);
    }
});

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
    );

    console.log('Commands registered.');
}

(async () => {
    await registerCommands();
    await client.login(TOKEN);
})();