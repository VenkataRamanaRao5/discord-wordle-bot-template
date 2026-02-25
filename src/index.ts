import { Client, Events, GatewayIntentBits } from 'discord.js';
import * as db from './db';
import type { SelectScoreWithRelations } from './db/schema';
import { TokenFlags } from 'typescript';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});
/*
https://enclose.horse Day 53
💎 PERFECT! 💎 100%

https://enclose.horse Day 53
🥇 Excellent! 🥇 94%

https://enclose.horse Day 53
🥉 okay 🥉 1%

https://enclose.horse Day 53
🥈 Great 🥈 86%

https://enclose.horse/api/daily/2026-02-16

{
    "id": "mHl7-4",
    "map": "...~....~.....~\n.~.~....~..~..C\n.~.C.0~.C..~.~.\n.~..~~~~~~~C.~.\n.C.~~~~~~~~~.C.\n..~~~~~~~~~~~..\n.~~~.......~~~.\n.~.....~.....~.\n.......~.......\n...H...~..~~~..\n~......~..~~~.~\n~......~..~~~.~\n~......~...~C.~\n....~..~~~~~...\n....~0.~...~~..\n~....~~....~.~.\n~..........~..~",
    "budget": 11,
    "name": "Cherry Rain",
    "description": null,
    "creatorName": "Shivers",
    "playCount": 13301,
    "createdAt": 1771057126,
    "isDaily": true,
    "dailyDate": "2026-02-16",
    "dayNumber": 49
}

https://enclose.horse/api/levels/6PUvvl/stats

{
"optimalScore": 75,
}
*/

const horsePattern = /https:\/\/enclose\.horse\/? Day (\d+)\n(?:💎 PERFECT! 💎|🥇 Excellent! 🥇|🥈 Great 🥈|🥉 okay 🥉) (\d+%)/;

type HorseResult = {
    discordId: string;
    userName: string;
    dayNumber: number;
    score: number;
    percentage: number;
};

let todayLevelId = "",
    todayOptimalScore = 0,
    yesterdayLevelId = "",
    yesterdayOptimalScore = 0;

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`Logged in as ${readyClient.user?.tag}`);
    await getTodayOptimal();
});

client.on(Events.MessageCreate, async (message) => {
    const parsedHorse = parseHorseResult(message);
    if (parsedHorse) {
        const currentResults = await processLatestHorseResult(parsedHorse);
        console.log(currentResults);
        const winnerMessage = `<@${message.author.id}> <@${message.author.username}> won enclose horse ${parsedHorse.dayNumber} with score ${parsedHorse.score}!`;
        //await message.channel.send(winnerMessage)
        await processCurrentResults(currentResults, message);
    } else {
        console.log('Message was determined to not be intended for the bot');
    }
});

await client.login(process.env.DISCORD_BOT_TOKEN);

console.log("Hello via Bun!");

async function getTodayOptimal(): Promise<void> {
    const date = new Date().toLocaleDateString("en-CA")
    console.log(date)

    fetch(`https://enclose.horse/api/daily/${date}`)
        .then(response => response.json())
        .then(mapData => {
            todayLevelId = mapData['id']
            console.log(mapData, todayLevelId)
            return fetch(`https://enclose.horse/api/levels/${todayLevelId}/stats`)
        })
        .then(response => response.json())
        .then(stats => {
            todayOptimalScore = stats["optimalScore"]
            console.log(todayOptimalScore)
        })
}

function parseHorseResult(message: any): HorseResult | undefined {
    const userName = message.author.username;
    const discordId = message.author.id;
    const match = horsePattern.exec(message.content);

    console.log(match, `|${message.content}|`)

    if (match) {
        const dayNumber = parseInt(match[1]);
        const percentage = parseInt(match[2].replace('%', ''))
        const score = Math.floor(percentage * todayOptimalScore / 100.0);

        return {
            discordId,
            userName,
            dayNumber,
            score,
            percentage
        };
    }

    return undefined;
}

async function processCurrentResults(currentResults: SelectScoreWithRelations[], message: any) {
  try {
    if (currentResults.length > 0) {
      const winners: SelectScoreWithRelations[] = await determineWinners(currentResults);
      if (winners.length > 0) {
        await informLatestResults(winners, message);
      }
    } else {
      console.log('No results from processing the latest enclose horse result.');
    }
  } catch (error) {
    console.error('Error processing enclose horse Result:', error);
  }
}

async function processLatestHorseResult(parsedHorse: HorseResult): Promise<SelectScoreWithRelations[]> {
  // Prevent duplicates
  const scoresForCurrentGame = await db.getScoresByDayNumber(parsedHorse.dayNumber);
  const existingResultForUser = scoresForCurrentGame.find((score: SelectScoreWithRelations) => score.discordId === parsedHorse.discordId);
  if (!existingResultForUser) {
    await db.createPlayer(parsedHorse.discordId, parsedHorse.userName);
    if(scoresForCurrentGame.length === 0) {
      await db.createHorse(parsedHorse.dayNumber, todayOptimalScore);
    }
    const addedScore = await db.createScore(parsedHorse.discordId, parsedHorse.dayNumber, parsedHorse.score, parsedHorse.percentage);
    if(addedScore){
      scoresForCurrentGame.push(addedScore);
    } else {
      console.error(`Error adding result to the database: ${parsedHorse.dayNumber} - ${parsedHorse.userName}`);
    }
  } else {
    console.log(`Result already exists: ${parsedHorse.dayNumber} - ${parsedHorse.userName}`);
  }
  return scoresForCurrentGame;
}


async function determineWinners(results: SelectScoreWithRelations[]): Promise<SelectScoreWithRelations[]> {
  if (!results || results.length === 0) return [];

  if (results.length === 0) return [];

  // Find maximum score
  const maxScore = Math.max(
    ...results.map(result => result.score)
  );

  console.log(maxScore, results.map(result => result.score))

  // Return all scores that match maximum score
  return results.filter((_, index) =>
    results[index].score === maxScore
  );
}

async function informLatestResults(winners: SelectScoreWithRelations[], message: any) {
  const winnerDiscordIds = winners.map(winner => winner.discordId);
  const winnerDiscordTags = winnerDiscordIds.map(id => `<@${id}>`);

  const dayNumber = winners[0].dayNumber || 1;
  const winningScore = winners[0].score;
  const winningPercentage = winners[0].percentage;
  const winnerTags = winnerDiscordTags.join(', ');

  const winnerMessage = `Current Winner${winners.length > 1 ? "s" : ""} for Horse ${dayNumber.toLocaleString()} with ${winningScore} (${winningPercentage}%) score: ${winnerTags}`;

  console.log(winnerMessage);
  await message.channel.send(winnerMessage);
}