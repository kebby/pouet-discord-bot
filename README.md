# PouetDiscordBot

A bot to spam #pouet on demoscene discord with highly relevant pouet stuff,
and also add new items from news.scene.org to #news

Made with Typescript and discord.js

## Building

"npm build", basically 

## Running

You can do it, I trust you. Set up a bot at Discord first, tho.
If you want to make the bot persistent, https://www.npmjs.com/package/forever is an easy way to to so.

## Config

You'll need a file called config.json in the same dir looking almost like this:

```javascript
{
  "bottoken": "the secret token that you won't even find in the commit history",
  "pouetchannel": "channel id to post prods into",
  "newschannel": "channel id to post news into",
  "totm_minute": 30, // minute at which to post a new top of the month item,
  "totm_maxrank": 10, // maximum rank at which news prods can enter the top of the month
  "potd_hour": 13, // hour at which to post a new random cool prod
}
```
