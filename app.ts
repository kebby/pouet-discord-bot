import * as Discord from "discord.js" 
import fetch from "node-fetch";
import * as fs from "fs";

const tokenfile = "bottoken.txt";
const seenfile = "seenids.json";

// retrieve top of the month from pouet.net
async function getMonthlyTop()
{
    const response = await fetch("https://api.pouet.net/v1/front-page/top-of-the-month/");
    const result = await response.json() as RankedResult;
    if (!result.success) return;
    return result.prods;
}

let seenIds: number[] = [];

if (fs.existsSync(seenfile)) {
    seenIds = JSON.parse(fs.readFileSync(seenfile, { encoding: "utf8" }));
}

console.log('Hello world');

const client = new Discord.Client();

// when the client is ready, run this code
// this event will only trigger one time after logging in
client.once('ready', () => {
    console.log('Ready!');
});

// login to Discord with your app's token
client.login(fs.readFileSync(tokenfile, { encoding: "utf8" }));


getMonthlyTop();

fs.writeFileSync(seenfile, JSON.stringify(seenIds));
