# Loldle

A Discord bot for League of Legends champion guessing games. It includes Classic, Ability, Quote, and Skin modes, along with player statistics and leaderboards.

## Requirements

- Node.js 22.12.0 or newer
- A Discord application and bot
- A Discord server where you can add the bot

## Setup

1. Clone or download the project.
2. Install the dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in the three values:

   ```env
   TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_id
   GUILD_ID=your_discord_server_id
   ```

4. In the Discord Developer Portal, enable the `bot` and `applications.commands` OAuth2 scopes and add the bot to your server. The bot needs permission to view channels, send messages, and attach files. It also needs **Connect** and **Speak** to play Quote mode audio.
5. Start the bot:

   ```bash
   npm start
   ```

The bot registers its slash commands in the server specified by `GUILD_ID` whenever it starts. Keep the `.env` file private; do not commit your bot token.

On Windows, `start.vbs` can be used to launch the bot without leaving a terminal window open.

## Commands

| Command | Description |
| --- | --- |
| `/loldle classic` | Start a Classic game. Guesses show attribute comparisons. |
| `/loldle ability` | Guess the champion from a rotated, obscured ability image. |
| `/loldle quote` | Guess the champion from a voice line and its text. |
| `/loldle skin` | Guess the champion from a cropped splash image. |
| `/g champion` | Submit a champion guess. |
| `/hint` | Reveal the next hint for the current game mode. |
| `/ff` | Vote to end the current game and reveal the answer. |
| `/loldle stats [user]` | Show your stats or another member's stats. |
| `/loldle board [scope] [mode] [sort] [top]` | Show the leaderboard. |
| `/loldle setchannel channel` | Set the voice channel used for Quote mode audio. |
| `/loldle list` | List players currently marked as active. |
| `/loldle leave` | Remove yourself from the active player list. |
| `/loldle zreset` | Reset your own statistics. |

For `/loldle board`, `scope` can be `both`, `single`, or `multi`; `mode` can be `all`, `classic`, `quote`, `ability`, or `skin`; `sort` can be `wins`, `games`, or `winrate`; and `top` controls how many players are shown (1–20). Win-rate rankings omit players with fewer than five recorded games.

### Game modes

- **Classic:** Each guess is compared with the answer by gender, position, species, resource, attack type, region, and release year.
- **Ability:** The starting image is rotated and grayscale. The first hint removes the rotation; the second reveals the original image.
- **Quote:** The quote is shown when the game starts. Use `/hint` to play the audio; later hints reveal champion attributes. Set a voice channel with `/loldle setchannel` first.
- **Skin:** The game starts with a small crop of a champion splash image. Each hint reveals a larger crop.

The `/ff` command uses votes from active players. Players are added to the active list when they start or interact with a game. The list is cleared automatically once an hour; players can also use `/loldle leave` to remove themselves.

## Data and scripts

- `data/champions.json` contains champion attributes, ability image URLs, and skin image URLs.
- `data/quoteCache.json` stores the text and audio URLs used by Quote mode.
- `data/settings.json` stores each server's selected voice channel.
- `data/stats.json` stores player statistics.

The project uses champion data originally based on [LoLdleData](https://github.com/Kerrders/LoLdleData), with image assets hosted by Riot's Data Dragon. Quote data is collected from the League of Legends Wiki.

To update the local data:

```bash
npm run update:skins
npm run update:quotes
```

The skin script adds newly found skins to the existing champion data. The quote script fills missing quote-cache entries and keeps existing entries. Both scripts require an internet connection.

## Project structure

```text
.
├── data/           # Champion data, quote cache, settings, and stats
├── lib/            # Guess comparison, image processing, random selection, and stats
├── scripts/        # Data update scripts
├── index.js        # Discord client and command handlers
├── .env.example    # Required environment variable template
└── package.json
```

## License and attribution

The project is licensed under the ISC license. League of Legends names and assets belong to Riot Games; this project is unofficial and is not affiliated with or endorsed by Riot Games.
