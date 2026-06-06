//
// Pouet Discord Bot (aka "Klaxon")
// (C) Tammo Hinrichs 2020-2021, see LICENSE for details (spoilers: it's MIT)
//

import * as Discord from "discord.js";
import * as schedule from "node-schedule";
import * as fs from "fs";
import { Readable } from "stream";
import ordinal from "ordinal";
import escape from "markdown-escape";
import TurndownService from "turndown";
import { streamArray } from "stream-json/streamers/stream-array.js";
import { crc32, createGunzip } from "zlib";
import chain from "stream-chain";
import { pick } from "stream-json/filters/pick.js";
import * as cheerio from "cheerio";
import svg2img from "svg2img";

const apiRoot = "https://api.pouet.net/v1/";
const capitalize = (word: string) =>
    word.charAt(0).toUpperCase() + word.slice(1);

//------------------------------------------------------------------------------
// Configuration

interface Config {
    bottoken: string;
    pouetchannel: string;
    newschannel: string;
    testchannel: string;
    totm_minute: number;
    totm_maxrank: number;
    potd_hour: number;
}

const config: Config = JSON.parse(fs.readFileSync("config.json", "utf8"));

let isWasmInitialized = false;

function convertSvgToPngBuffer(svgString: string) {
    /*
    // 1. Initialize WASM once at runtime
    if (!isWasmInitialized) {
        // Fetch and read the compiled WASM binary distributed within the package
        const wasmBuffer = fs.readFileSync(
            "node_modules/svg2png-wasm/svg2png_wasm_bg.wasm",
        );
        await initialize(wasmBuffer);
        isWasmInitialized = true;
    }

    // 2. Convert SVG string directly to a PNG Uint8Array, then cast to Buffer
    const uint8Array = await svg2png(svgString, {
        height: 80,
    });

    return Buffer.from(uint8Array);*/

    return new Promise<Buffer>((resolve, reject) =>
        (svg2img as any)(
            svgString,
            {
                resvg: {
                    fitTo: {
                        mode: "height",
                        value: 80,
                    },
                },
            },
            (error: any, buffer: Buffer) => {
                if (error) reject(error);
                resolve(buffer);
            },
        ),
    );
}
//------------------------------------------------------------------------------
// Pouet API helper functions

async function getMonthlyTop() {
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

const client = new Discord.Client({ intents: "MessageContent" });
let pouetChannel: Discord.TextChannel;
let newsChannel: Discord.TextChannel;

// post a prod to channel as a rich embed
async function PostProd(
    channel: Discord.TextChannel,
    id: number,
    header: string = "",
) {
    // fetch prod details from pouet...
    const prod = await getProd(id);
    if (!prod) return;

    // .... and make a post about it!
    const url = "https://www.pouet.net/prod.php?which=" + id;
    let embed = new Discord.EmbedBuilder()
        .setColor("#557799")
        .setTitle(prod.name)
        .setURL(url)
        .setImage(prod.screenshot)
        .setTimestamp(Date.parse(prod.releaseDate));

    // description ...
    let desc = prod.types.map(capitalize).join(", ");
    if (desc) desc += " for ";
    desc += Object.values(prod.platforms)
        .map((pl) => pl.name)
        .join(", ");

    // ... invi?
    if (prod.invitation) {
        const party = await getParty(parseInt(prod.invitation));
        if (party) {
            if (desc) desc += "\n";
            desc += `Invitation to ${party.name} ${prod.invitationyear}`;
        }
    }

    // .. placings
    for (let pl of prod.placings) {
        const rank = parseInt(pl.ranking);
        let party = "";
        if (pl.party.name) {
            party = ` at ${pl.party.name}`;
            if (pl.year) party = party + ` ${pl.year}`;
        }
        if (pl.compo_name == "none" || !pl.compo_name) {
            if (party) desc += `\nReleased${party}`;
        } else if (rank > 0 && rank < 97) {
            desc += `\nPlaced ${(ordinal as any)(rank)} in the ${pl.compo_name} compo${party}`;
        } else {
            desc += `\nFor the ${pl.compo_name} compo${party}`;
        }
    }

    if (desc) embed.setDescription(escape(desc));

    // groups
    if (prod.groups.length)
        embed.setAuthor({
            name: prod.groups.map((g) => g.name).join(" & "),
        });

    // credits
    if (prod.credits.length) {
        const credits = prod.credits.map((c) =>
            escape(`${c.user.nickname} (${c.role})`),
        );
        embed.addFields({
            name: "Credits",
            value: credits.join("\n"),
            inline: true,
        });
    }

    // links
    let dlfield = `**[Download](${prod.download.replace(" ", "%20")})**`;
    for (let link of prod.downloadLinks.filter((l) =>
        l.link.startsWith("http"),
    ))
        dlfield += `\n[${capitalize(link.type)}](${link.link.replace(" ", "%20")})`;
    embed.addFields({ name: "Links", value: dlfield, inline: true });

    await channel.send({ content: header + url, embeds: [embed] });
}

//------------------------------------------------------------------------------
// Jobs

async function TopOfTheMonth() {
    try {

        // get seen prod ids
        const seenfile = "seenids.json";
        let seenIds: number[] = [];
        if (fs.existsSync(seenfile)) {
            seenIds = JSON.parse(fs.readFileSync(seenfile, "utf8"));
        }

        let prods = await getMonthlyTop();
        if (!prods) return;

        for (let p of prods) {
            let prod = p.prod;

            // find a prod that we haven't posted about yet
            let id = parseInt(prod.id);
            if (seenIds.includes(id) || p.rank > config.totm_maxrank) continue;

            console.log("posting new Top Of The Month...");
            console.log(`it is #${prod.id}: ${prod.name}`);

            await PostProd(
                pouetChannel,
                id,
                `New in the top of the month at rank ${p.rank}: `,
            );

            seenIds.push(id);
            break; // one is enough
        }

        fs.writeFileSync(seenfile, JSON.stringify(seenIds.slice(-1000)));
    } catch (e) {
        console.error(`Could not update Top Of The Month: ${e}`);
    }
}

interface ProdCache {
    filename: string;
    ids: number[];
}

async function RandomCoolProd() {
    try {
        console.log("Random cool prod...");

        // get seen prod ids
        const seenfile = "seenids.json";
        let seenIds: number[] = [];
        if (fs.existsSync(seenfile))
            seenIds = JSON.parse(fs.readFileSync(seenfile, "utf8"));

        // get prod cache
        const cachefile = "coolprods.json";
        let prodCache: ProdCache | null = null;
        if (fs.existsSync(cachefile))
            prodCache = JSON.parse(fs.readFileSync(cachefile, "utf8"));

        // get latest prods dump
        const resp = await fetch("https://data.pouet.net/json.php");
        const dumpList = (await resp.json()) as pouet.DumpList;
        if (dumpList.latest.prods.filename != prodCache?.filename) {
            console.log("prod cache is invalid, fetching new dump");

            try {
                const dresp = await fetch(dumpList.latest.prods.url);
                if (!dresp.body) return;

                const ids: number[] = [];

                // filter down to only ids of applicable prods
                // using streaming gunzip/JSON parsing so we can still run on low memory
                const pipeline = chain([
                    Readable.from(dresp.body),
                    createGunzip(),
                    pick.withParser({ filter: "prods" }),
                    streamArray(),
                ]);

                for await (const { value } of pipeline) {
                    const prod = value as pouet.Prod;
                    const id = parseInt(prod.id);
                    if (
                        parseInt(prod.voteup) >= 30 &&
                        parseFloat(prod.voteavg) >= 0.5 &&
                        !seenIds.includes(id)
                    )
                        ids.push(id);
                }

                prodCache = {
                    filename: dumpList.latest.prods.filename,
                    ids: ids,
                };
                fs.writeFileSync(cachefile, JSON.stringify(prodCache));
            } catch (e) {
                console.error("could not get prod dump", e);
            }
        }

        if (!prodCache) return;

        console.log(`${prodCache.ids.length} prods eligible`);

        const rnd = Math.sqrt(Math.random()); // prefer newer prods
        const index = Math.floor(rnd * prodCache.ids.length);
        const id = prodCache.ids[index];
        console.log(`it is #${id}`);

        await PostProd(pouetChannel, id, "Random cool prod of the day: ");

        seenIds.push(id);
        fs.writeFileSync(seenfile, JSON.stringify(seenIds.slice(-1000)));
    } catch (err) {
        console.error("could not post random prod", err);
    }
}

async function SceneOrgNews() {
    try {
        // get seen news ids
        const seenfile = "seennews.json";
        let seenIds: number[] = [];
        if (fs.existsSync(seenfile)) {
            seenIds = JSON.parse(fs.readFileSync(seenfile, "utf8"));
        }

        const resp = await fetch("https://news.scene.org/feeds/json/", {
            headers: {
                "User-Agent": "Random Discord bot (probably Klaxon)",
            },
        });
        const json = (await resp.json()) as news.NewsFeed;

        const turndown = new TurndownService({
            headingStyle: "atx",
            hr: "---",
            codeBlockStyle: "fenced",
        });

        for (const item of json.items.sort((a, b) => a.id - b.id)) {
            if (seenIds.includes(item.id)) continue;

            console.log(`Posting news ${item.id}: ${item.title}`);

            // convert any newlines in the HTML that aren't preceding a block tag into un unused unicode codepoint for later
            let description = item.contents.replaceAll(
                /\n(?!\s*<(?!em|b|i))/g,
                "\ueeee",
            );

            // convert html to markdown
            description = turndown.turndown(description);

            // discord doesn't like links with the URL as description; remove that description.
            description = description.replaceAll(/\[https?:.*]\((.+)\)/g, "$1");

            // restore and collapse newline chains
            description = description
                .replaceAll(/\ueeee/g, "  \n")
                .replaceAll(/\s+\n\s+\n\s+\n/g, "\n\n");

            // trim
            description = description.trim();

            const embed = new Discord.EmbedBuilder()
                .setTimestamp(Date.parse(item.pubDate))
                .setColor("#ff7a00");

            let attachment: Discord.AttachmentBuilder | null = null;

            // parse federated feed info
            const re = /^\\\[ \*\*(.+?)\*\* \\\] \[(.+?)\]\((.+?)\)\s*(.*)/gs;
            const match = re.exec(description);

            if (match) {
                // set fields
                embed
                    .setTitle(match[2])
                    .setURL(match[3])
                    .setDescription(
                        match[4] + `\n\nvia [news.scene.org](${item.url})`,
                    )
                    .setAuthor({
                        name: match[1],
                    });

                try {
                    // follow the feed link and let's see if we can extract some metadata
                    const resp = await fetch(match[3]);
                    const html = await resp.text();
                    const $ = cheerio.load(html);

                    let hasColor = false;
                    let iconURL: string = "";
                    $("meta").each((_, el) => {
                        const tag = $(el);
                        const content = tag.attr("content");
                        if (content) {
                            switch (tag.attr("name") || tag.attr("property")) {
                                case "theme-color": // set embed stripe color to the site's theme color 
                                    embed.setColor(content as any);
                                    hasColor = true;
                                    break;
                                case "og:image": // set embed image
                                    const uri = new URL(content, match[3]);
                                    embed.setImage(uri.toString());
                                    break;
                            }
                        }
                    });
                    $("link").each((_, el) => {
                        const tag = $(el);
                        const content = tag.attr("href");
                        if (content) {
                            switch (tag.attr("rel")) {
                                case "icon": // find author icon
                                    if (!iconURL)
                                        iconURL = new URL(
                                            content,
                                            match[3],
                                        ).toString();
                                    break;
                            }
                        }
                    });

                    // set default color from feed name
                    if (!hasColor) {
                        const color =
                            "#" +
                            (crc32(match[1]) & 0xffffff)
                                .toString(16)
                                .padStart(6, "0");
                        embed.setColor(color as any);
                    }

                    // set author icon form site's favicon
                    if (iconURL) {
                        if (iconURL.toLowerCase().endsWith("svg")) {
                            // convert SVG to PNG and attach
                            const resp = await fetch(iconURL);
                            const svg = await resp.text();
                            const png = await convertSvgToPngBuffer(svg);
                            attachment = new Discord.AttachmentBuilder(png, {
                                name: "icon.png",
                            });
                            embed.setAuthor({
                                name: match[1],
                                iconURL: "attachment://icon.png",
                            });
                        } else {
                            embed.setAuthor({
                                name: match[1],
                                iconURL: iconURL,
                            });
                        }
                    }
                } catch (e) {
                    console.error("accessing 3rd party news page failed", e);
                }
            } else {
                embed
                    .setTitle(item.title)
                    .setURL(item.url)
                    .setDescription(description)
                    .setAuthor({
                        name: "news.scene.org",
                        iconURL: "https://news.scene.org/favicon.png",
                    });
            }
            //console.log(embed);
            const payload: Discord.MessageCreateOptions = { embeds: [embed] };
            if (attachment) payload.files = [attachment];
            await newsChannel.send(payload);

            seenIds.push(item.id);
            break;
        }

        fs.writeFileSync(seenfile, JSON.stringify(seenIds));
    } catch (e) {
        console.error(`Could not update news: ${e}`);
    }

    setTimeout(SceneOrgNews, 2 * 60 * 1000);
}

//------------------------------------------------------------------------------
// Top level function

async function Bot() {
    console.log("pouet-discord-bot starting...");

    // log in and get channel
    await client.login(config.bottoken);
    pouetChannel = (await client.channels.fetch(
        config.pouetchannel,
    )) as Discord.TextChannel;
    newsChannel = (await client.channels.fetch(
        config.newschannel,
    )) as Discord.TextChannel;
    console.log(
        `logged in; channels: ${pouetChannel.name}/${newsChannel.name}`,
    );

    schedule.scheduleJob({ minute: config.totm_minute }, TopOfTheMonth);
    schedule.scheduleJob({ hour: config.potd_hour, minute: 5 }, RandomCoolProd);
    SceneOrgNews();
}

Bot();
