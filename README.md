# PouetDiscordBot

A bot to spam #pouet on demoscene discord with highly relevant pouet stuff. 

Made with Typescript and discord.js

(yeah, I'm using Visual Studio. Sue me. It works without tho 😊 )

## Building

"npm install" and "npm run build", basically 

## Running

You can do it, I trust you (Hint: "npm start"). First set up a bot at Discord and read the next section tho.

### Actually running

If you want to run it persistently, I'd suggest using Forever:

* Install Forever: `sudo npm install -g forever`
* Run the bot forever: `forever start app.js`

## Config

You'll need a file called config.json in the same dir and it shall look a little like this:

```javascript
{
  "bottoken": "the secret token that you won't even find in the commit history",
  "pouetchannel": "channel id to post into",
  "totm_minute": 5,
  "totm_maxrank": 10
}
```
