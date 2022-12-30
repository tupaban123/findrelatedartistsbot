require('dotenv').config();
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
const SpotifyWebApi = require("spotify-web-api-node");
const cloudinary = require("cloudinary").v2;


var spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_SECRET_CLIENT_ID
});

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_SECRET_API_KEY
});

async function setAccessToken()
{
    var access_token = (await spotifyApi.clientCredentialsGrant()).body.access_token;
    await spotifyApi.setAccessToken(access_token);
}

function getImageURL(artist)
{
    var artistImages = artist.images;

    if(artistImages.length == 0)
    {
        var artistName = artist.name.replace(' ', '\n');
        url = cloudinary.url("image_kzzzcp.jpg", {transformation: [
                {background: "#000000", color: "#000000"},
                {background: "#000000", color: "#ffffff", overlay: {font_family: "Arial", font_size: 24, font_weight: "bold", text: artistName}}
            ]});

        return url;
    }

    url = artistImages[0].url;
    return url;
}

function getArtistSpotifyLink(artist)
{
    return artist.external_urls.spotify;
}

function getGeneralGenres(artist, currentArtist)
{
    var enteredArtistGenres = artist.genres;
    var currentArtistGenres = currentArtist.genres;
    var generalGenresArray = [];

    currentArtistGenres.forEach(element => {
        if (enteredArtistGenres.includes(element)) {
            generalGenresArray.push(element);
        }
    })

    var generalGenres = "Отсутствуют";

    if (generalGenresArray.length !== 0) {
        generalGenres = "";

        for (let i = 0; i < generalGenresArray.length; i++) {
            var end = ", ";

            if (i == generalGenresArray.length - 1) {
                end = "";
            }

            generalGenres += generalGenresArray[i] + end;
        }
    }

    return generalGenres;
}

bot.on('inline_query', async ctx => {
  await setAccessToken();

  var artists = [];
  var artist;
  var results = [];
  var id;

  tryfindartist: try {
    var entered = ctx.inlineQuery.query;

    //https://open.spotify.com/artist/7B9Gg9epjQzfNGdxijFczG?si=6a60e02166194174
    if (entered.startsWith("https://open.spotify.com/artist/")) {
      var withoutDomen = entered.split("/");

      var idToSet = withoutDomen[withoutDomen.length - 1].split("?");
      id = idToSet[0];
      artist = (await spotifyApi.getArtist(id)).body;
      break tryfindartist;
    }

    findedArtists = (await spotifyApi.searchArtists(entered));

    if(findedArtists.body.artists.items.length == 0)
    {
        throw {statusCode: 400};
    }

    artist = findedArtists.body.artists.items[0];
    id = artist.id;

  } catch (err) {
    if (err.statusCode == 400) {
      var title = "Я не смог распознать артиста."
      var description = "Скорее всего, вы неправильно указали артиста или я его не могу найти в Spotify"
      var message = "Я не смог найти исполнителя. Напишите /help для помощи."

      results.push({
        type: 'article',
        id: 'notFind',
        title: title,
        description: description,
        input_message_content: {
          message_text: message
        }
      });
      ctx.answerInlineQuery(results, {cache_time: 0, is_personal: true});
      return;
    }
  }

  try {
      artists = (await spotifyApi.getArtistRelatedArtists(id)).body.artists;
      var enteredArtistImageLink = getImageURL(artist);

      var enteredArtistKeyboard = [
          [{text: "Открыть Telegram-канал разработчика", url: "https://t.me/tupadev"}]
      ];

      results.push(
          {
              type: 'article',
              id: 'artist_' + artist.id,
              title: "Нажмите, что бы показать информацию о " + artist.name,
              description: 'Или выберите исполнителя ниже, который похож на ' + artist.name,
              thumb_url: enteredArtistImageLink,
              photo_url: enteredArtistImageLink,
              input_message_content:{ message_text: "Загрузка..." },
              reply_markup: {
                  inline_keyboard: enteredArtistKeyboard
              },
              parse_mode:"HTML"
          });

      for (let i = 0; i < artists.length; i++) {
          var currentArtist = artists[i];

          var artistImageLink = getImageURL(currentArtist);

          var artistKeyboard = [
              [{text: "Открыть Telegram-канал разработчика", url: "https://t.me/tupadev"}]
          ];

          results.push({
              type: 'article',
              id: 'artist_' + currentArtist.id + "_" + artist.id,
              thumb_url: artistImageLink,
              title: currentArtist.name,
              description: `Нажмите, что бы показать информацию о ${currentArtist.name}`,
              input_message_content:{ message_text: "Загрузка..." },
              reply_markup: {
                  inline_keyboard: artistKeyboard
              },
              parse_mode:"HTML"
          });
      }

      ctx.answerInlineQuery(results, {cache_time: 0, is_personal: true});
  }
    catch(err) {
        var title = "Что то пошло не так..."
        var description = "Нажмите, что бы увидеть больше информации"
        var message = "Что то пошло не так на стороне сервера, попробуйте пожалуйста снова. Если проблема не пропадает, обратитесь к разработчику."

        results.push({
            type: 'article',
            id: 'somethingWrong',
            title: title,
            description: description,
            input_message_content: {
                message_text: message
            }
        });
        ctx.answerInlineQuery(results, {cache_time: 0, is_personal: true});
    }

});

bot.on('chosen_inline_result', async ctx => {
    await setAccessToken();
    var inlineMessageID = ctx.update.chosen_inline_result.inline_message_id;

    if(ctx.update.chosen_inline_result.result_id.startsWith("artist"))
    {
        var message = "";
        var artistKeyboard = [];

        var result_id = ctx.update.chosen_inline_result.result_id;
        var splitResult = result_id.split("_");

        if(splitResult.length === 2)
        {
            var artistID = splitResult[1];
            var artist = (await spotifyApi.getArtist(artistID)).body;

            var artistLink = getArtistSpotifyLink(artist);
            var artistImageLink = getImageURL(artist);

            var topTracks = (await spotifyApi.getArtistTopTracks(artistID, "GB")).body;

            var topTracksStr = "";

            artistKeyboard = [
                [{text: "Открыть профиль исполнителя в Spotify", url: artistLink}],
                [{text: "Открыть Telegram-канал разработчика", url: "https://t.me/tupadev"}]
            ];

            for(var i = 0; i < 5; i++)
            {
                var currentTrackLink = topTracks.tracks[i].external_urls.spotify;

                topTracksStr += `<a href="${currentTrackLink}">${topTracks.tracks[i].name}</a>\n`;
            }

            message = `Информация про ${artist.name}<a href="${artistImageLink}">🎵</a>:
          \nПодписчики: ${artist.followers.total}
          \n\nТоп-5 треков: \n${topTracksStr}`;

        }
        else {
            var sendedArtistID = splitResult[2];
            var artistID = splitResult[1];

            var sendedArtist = (await spotifyApi.getArtist(sendedArtistID)).body;
            var artist = (await spotifyApi.getArtist(artistID)).body;

            var topTracks = (await spotifyApi.getArtistTopTracks(artistID, "GB")).body;

            var topTracksStr = "";
            var generalGenres = getGeneralGenres(sendedArtist, artist);

            var sendedArtistLink = getArtistSpotifyLink(sendedArtist);

            var artistLink = getArtistSpotifyLink(artist);
            var artistImageLink = getImageURL(artist);

            artistKeyboard = [
                [{text: "Открыть профиль исполнителя в Spotify", url: artistLink}],
                [{text: "Открыть Telegram-канал разработчика", url: "https://t.me/tupadev"}]
            ];

            for (var i = 0; i < 5; i++) {
                var currentTrackLink = topTracks.tracks[i].external_urls.spotify;

                topTracksStr += `<a href="${currentTrackLink}">${topTracks.tracks[i].name}</a>\n`;
            }

            message = `Информация про ${artist.name}<a href="${artistImageLink}">🎵</a>:\n\nСовпадения с <a href="${sendedArtistLink}">${sendedArtist.name}</a> по жанрам: ${generalGenres}
          \nПодписчики: ${artist.followers.total}
          \n\nТоп-5 треков: \n${topTracksStr}`;
        }

        await bot.telegram.editMessageCaption(undefined, undefined, inlineMessageID, message, {parse_mode: "HTML"});
        await bot.telegram.editMessageReplyMarkup(undefined, undefined, inlineMessageID,
            {inline_keyboard: artistKeyboard});
    }
});

bot.help(ctx => {
  bot.telegram.sendMessage(ctx.chat.id, "Я работаю в inline-режиме, это означает что меня можно использовать в любом чате. Просто упомяните меня и напишите интересующего вас исполнителя, и я найду похожих." +
      "\nПример: <code>@findrelatedartistsbot верка сердючка</code>" +
      "\n\nЕсли у вас возникли какие то вопросы/проблемы, <a href='https://t.me/tupalinks'>свяжитесь с разработчиком</a>", {parse_mode: "HTML"});
})

bot.start(ctx => {
  bot.telegram.sendMessage(ctx.chat.id, "Привет! Я - бот, который поможет тебе найти похожих исполнителей.\n\nНапиши /help для большей информации.");
})

bot.launch();