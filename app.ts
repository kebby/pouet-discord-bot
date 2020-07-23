//
// Pouet Discord Bot (aka "Klaxon")
// (C) Tammo Hinrichs 2020, see LICENSE for details (it's MIT)
//

import * as Discord from "discord.js" 
import fetch from "node-fetch";
import * as schedule from "node-schedule";
import * as fs from "fs";

const ordinal = require("ordinal");

const apiRoot = "https://api.pouet.net/v1/";
const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

//------------------------------------------------------------------------------
// Configuration

interface Config {
    bottoken: string,
    pouetchannel: string,
    totm_minute: number,
}

const config = JSON.parse(fs.readFileSync("config.json", "utf8")) as Config;

//------------------------------------------------------------------------------
// Pouet API helper functions

async function getMonthlyTop()
{
    const response = await fetch(apiRoot + "front-page/top-of-the-month/");
    const result: pouet.TopListResult = await response.json();
    return result.success ? result.prods : null;
}

async function getProd(id: number) {
    const response = await fetch(apiRoot + "prod/?id=" + id);
    const result: pouet.ProdResult = await response.json();
    return result.success ? result.prod : null;
}

async function getParty(id: number) {
    const response = await fetch(apiRoot + "party/?id=" + id);
    const result: pouet.PartyResult = await response.json();
    return result.success ? result.party : null;
}

//------------------------------------------------------------------------------
// Discord functionality

const client = new Discord.Client();
let pouetChannel: Discord.TextChannel;

async function PostProd(channel: Discord.TextChannel, prod: pouet.Prod, header: string = "") {
    const url = 'https://www.pouet.net/prod.php?which=' + prod.id;

    let embed = new Discord.MessageEmbed()
        .setColor('#557799')
        .setTitle(prod.name)
        .setURL(url)
        .setImage(prod.screenshot)
        .setTimestamp(Date.parse(prod.releaseDate));

    // description ...       
    var desc = prod.types.map(capitalize).join(", ");
    if (desc) desc += " for ";
    desc += Object.values(prod.platforms).map(pl => pl.name).join(", ");

    // ... invi?
    if (prod.invitation) {
        const party = await getParty(parseInt(prod.invitation))
        if (desc) desc += "\n";
        desc += `Invitation for ${party.name} ${prod.invitationyear}`;
    }

    // .. placings
    for (let pl of prod.placings) {
        const rank = parseInt(pl.ranking);
        if (pl.compo_name == "none") {
            desc += `\nReleased at ${pl.party.name} ${pl.year}`;
        }
        else if (rank < 97) {
            desc += `\nPlaced ${ordinal(rank)} in the  ${pl.compo_name} compo at ${pl.party.name} ${pl.year}`;
        }
    }

    if (desc)
        embed.setDescription(desc);

    // groups
    if (prod.groups.length)
        embed.setAuthor(prod.groups.map(g => g.name).join(" & "));

    // credits
    if (prod.credits.length) {
        const credits = prod.credits.map(c => `${c.user.nickname} (${c.role})`);
        embed.addField("Credits", credits, true);
    }

    // links
    let dlfield = `**[Download](${prod.download})**`;
    for (let link of prod.downloadLinks)
        dlfield += `\n[${capitalize(link.type)}](${link.link})`;
    embed.addField("Links", dlfield, true);

    channel.send(header + url, embed);
}

//------------------------------------------------------------------------------
// Jobs

async function TopOfTheMonth() {
    try {
        console.log("posting new Top Of The Month...");

        // get seen prod ids
        const seenfile = "seenids.json";
        let seenIds: number[] = [];
        if (fs.existsSync(seenfile)) {
            seenIds = JSON.parse(fs.readFileSync(seenfile, "utf8"));
        }

        let prods = await getMonthlyTop();

        for (let p of prods) {
            let prod = p.prod;

            // find a prod that we haven't posted about yet
            let id = parseInt(prod.id);
            if (seenIds.includes(id))
                continue;

            console.log(`it is #${prod.id}: ${prod.name}`);

            // fetch prod details from pouet...
            prod = await getProd(id);
            // .... and make a post about it!
            await PostProd(pouetChannel, prod, `New in the top of the month at rank ${p.rank}: `);

            seenIds.push(id);
            break; // one is enough
        }

        fs.writeFileSync(seenfile, JSON.stringify(seenIds));
    }
    catch (e) {
        console.error(`Could not update Top Of The Month: ${e}`);
    }
}


//------------------------------------------------------------------------------
// Top level function

async function Bot() {
    console.log("pouet-discord-bot starting...");

    // log in and get channel
    await client.login(config.bottoken);
    pouetChannel = await client.channels.fetch(config.pouetchannel) as Discord.TextChannel
    console.log(`logged in; channel: ${pouetChannel.name}`)

    schedule.scheduleJob({ minute: config.totm_minute }, TopOfTheMonth);  
}

Bot();
