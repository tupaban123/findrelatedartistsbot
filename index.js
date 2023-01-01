/*const CLOUDINARY_SECRET_API_KEY = process.env['CLOUDINARY_SECRET_API_KEY']
const CLOUDINARY_API_KEY = process.env['CLOUDINARY_API_KEY']
const CLOUDINARY_CLOUD_NAME = process.env['CLOUDINARY_CLOUD_NAME']
const SPOTIFY_SECRET_CLIENT_ID = process.env['SPOTIFY_SECRET_CLIENT_ID']
const SPOTIFY_CLIENT_ID = process.env['SPOTIFY_CLIENT_ID']
const BOT_TOKEN = process.env['BOT_TOKEN']

const { Telegraf } = require('telegraf');
const bot = new Telegraf(BOT_TOKEN);
const SpotifyWebApi = require("spotify-web-api-node");
const cloudinary = require("cloudinary").v2;
const fs = require('fs');

var spotifyApi = new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_SECRET_CLIENT_ID
});

cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_SECRET_API_KEY
});*/

require('dotenv').config();
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
const SpotifyWebApi = require("spotify-web-api-node");
const cloudinary = require("cloudinary").v2;
const fs = require('fs');

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

    var generalGenres = "Отсутствуют";

    if(currentArtist == undefined)
    {
        var generalGenres = "Отсутствуют";

        if (enteredArtistGenres.length !== 0) {
            generalGenres = "";

            for (let i = 0; i < enteredArtistGenres.length; i++) {
                var end = ", ";

                if (i == enteredArtistGenres.length - 1) {
                    end = "";
                }

                generalGenres += enteredArtistGenres[i] + end;
            }
        }
    }
    else {


        var currentArtistGenres = currentArtist.genres;
        var generalGenresArray = [];

        currentArtistGenres.forEach(element => {
            if (enteredArtistGenres.includes(element)) {
                generalGenresArray.push(element);
            }
        })

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
    }
    return generalGenres;
}

async function getArtistTopTracks(artist)
{
    var topTracks = (await spotifyApi.getArtistTopTracks(artist.id, "GB")).body;
    var topTracksStr = "У данного исполнителя треки отсутствуют";

    if(topTracks.tracks.length === 0)
    {
        return topTracksStr;
    }

    topTracksStr = "";
    var count = 5;

    if(topTracks.tracks.length < 5)
    {
        count = topTracks.tracks.length;
    }

    for(var i = 0; i < count; i++)
    {
        var currentTrackLink = topTracks.tracks[i].external_urls.spotify;

        topTracksStr += `<a href="${currentTrackLink}">${topTracks.tracks[i].name}</a>\n`;
    }

    return topTracksStr;
}

async function getUserLanguage(user)
{
    var lang = '';

    var usersString = (await fs.readFileSync("./languages.json", 'utf-8'));

    var usersObj = JSON.parse(usersString);

    var userData = undefined;

    for(let i = 0; i < usersObj.users.length; i++)
    {
        if(user.id === usersObj.users[i].userID)
        {
            userData = usersObj.users[i];
            break;
        }
    }

    if(userData === undefined)
    {
        if(user.language_code != 'en' && user.language_code != 'ru' && user.language_code != 'uk')
        {
            lang = 'en';
        }
        else
        {
            lang = user.language_code;
        }

        usersObj.users.push({"userID": user.id, "lang": lang});

        await fs.writeFile("./languages.json", JSON.stringify(usersObj), err => {if(err) console.log(err)});
    }
    else {
        lang = userData.lang;
    }

    return lang;
}

async function setUserLanguage(user, lang)
{
    var usersString = (await fs.readFileSync("./languages.json", 'utf-8'));

    var usersObj = JSON.parse(usersString);

    var userData = undefined;

    for(let i = 0; i < usersObj.users.length; i++)
    {
        if(user.id === usersObj.users[i].userID)
        {
            userData = usersObj.users[i];
            usersObj.users = arrayRemove(usersObj.users, usersObj.users[i]);
            break;
        }
    }

    if(userData === undefined)
        return;

    userData.lang = lang;

    usersObj.users.push(userData);
    await fs.writeFile("./languages.json", JSON.stringify(usersObj), err => {if(err) console.log(err)});
}

function arrayRemove(arr, value) {

    return arr.filter(function(ele){
        return ele != value;
    });
}

bot.on('inline_query', async ctx => {
  await setAccessToken();

  var artists = [];
  var artist;
  var results = [];
  var id;

  var lang = await getUserLanguage(ctx.update.inline_query.from);

  var devTGChannelText = '';

  var cantFindArtistTitle = '';
  var cantFindArtistDescription = '';
  var cantFindArtistMessage = '';

  var noRelatedArtistsTitle;
  var noRelatedArtistsDesc;

  var unknownTitle = ""
  var unknownDescription = ""
  var unknownMessage = ""

    switch(lang)
    {
        case 'ru':
            cantFindArtistTitle = "Я не смог распознать артиста."
            cantFindArtistDescription = "Скорее всего, вы неправильно указали артиста, или я его не могу найти в Spotify"
            cantFindArtistMessage = "Я не смог найти исполнителя. Напишите /help для помощи."
            devTGChannelText = "Открыть Telegram-канал разработчика";
            noRelatedArtistsTitle = "Похожие исполнители не найдены";
            unknownTitle = "Что то пошло не так..."
            unknownDescription = "Нажмите, что бы увидеть больше информации"
            unknownMessage = "Что то пошло не так на стороне сервера, попробуйте пожалуйста снова. Если проблема не пропадает, обратитесь к разработчику."
            break;
        case 'uk':
            cantFindArtistTitle = "Я не зміг розпізнати артиста."
            cantFindArtistDescription = "Скоріш за все, ви неправильно вказали артиста, або я його не можу знайти у Spotify"
            cantFindArtistMessage = "Я не зміг найти виконавця. Напишіть /help для допомоги."
            devTGChannelText = "Відкрити Telegram-канал розробника";
            noRelatedArtistsTitle = "Схожі виконавці не знайдені";
            unknownTitle = "Щось пішло не так..."
            unknownDescription = "Натисніть, щоб побачити більше інформації"
            unknownMessage = "Щось пішло не так на стороні сервера, спробуйте, будь ласка, знову. Якщо проблема не пропадає, зерніться до розробника."
            break;
        case 'en':
            cantFindArtistTitle = "I couldn't recognize the artist."
            cantFindArtistDescription = "You must have entered the artist incorrectly or I can't find it on Spotify"
            cantFindArtistMessage = "I couldn't find the artist. Type /help for help."
            devTGChannelText = "Open the developer's Telegram-channel";
            noRelatedArtistsTitle = "Similar artists not found";
            unknownTitle = "Something went wrong...";
            unknownDescription = "Click to see more information";
            unknownMessage = "Something went wrong on the server side, please try again. If the problem persists, contact the developer.";
            break;
    }

  tryfindartist: try {
    var entered = ctx.inlineQuery.query;

    if (entered.startsWith("https://open.spotify.com/artist/")) {
      var withoutDomen = entered.split("/");

      var idToSet = withoutDomen[withoutDomen.length - 1].split("?");
      id = idToSet[0];
      artist = (await spotifyApi.getArtist(id)).body;
      break tryfindartist;
    }

    var findedArtists = (await spotifyApi.searchArtists(entered));

    if(findedArtists.body.artists.items.length == 0)
    {
        throw {statusCode: 400};
    }

    artist = findedArtists.body.artists.items[0];
    id = artist.id;

  } catch (err) {
    if (err.statusCode == 400) {

      results.push({
        type: 'article',
        id: 'notFind',
        title: cantFindArtistTitle,
        description: cantFindArtistDescription,
        input_message_content: {
          message_text: cantFindArtistMessage
        }
      });
      ctx.answerInlineQuery(results, {cache_time: 0});
      return;
    }
  }

    switch (lang)
    {
        case "ru":
            noRelatedArtistsDesc = `К сожалению, исполнителей, похожих на ${artist.name} не найдено.`;
            break;
        case "uk":
            noRelatedArtistsDesc = `Нажаль, виконавців, схожих на ${artist.name} не знайдено.`;
            break;
        case "en":
            noRelatedArtistsDesc = `Sorry, no artists found similar to ${artist.name}.`;
            break;
    }

  try {
      artists = (await spotifyApi.getArtistRelatedArtists(id)).body.artists;
      var enteredArtistImageLink = getImageURL(artist);

      var enteredArtistKeyboard = [
          [{text: devTGChannelText, url: "https://t.me/tupalinks"}]
      ];

      var enteredArtistTitle;
      var enteredArtistDesc;
      var enteredArtistText;

      switch (lang)
      {
          case "ru":
              enteredArtistTitle = "Нажмите, что бы показать информацию о ";
              enteredArtistDesc = "Или выберите исполнителя ниже, который похож на ";
              enteredArtistText = "Загрузка...";
              break;
          case "uk":
              enteredArtistTitle = "Натисніть, щоб показати інформацію про ";
              enteredArtistDesc = "Або виберіть виконавця нижче, котрий схож на ";
              enteredArtistText = "Завантаження...";
              break;
          case "en":
              enteredArtistTitle = "Click to show information about ";
              enteredArtistDesc = "Or select an artist below that is similar to ";
              enteredArtistText = "Loading...";
              break;
      }

      results.push(
          {
              type: 'article',
              id: 'artist_' + artist.id,
              title: enteredArtistTitle + artist.name,
              description: enteredArtistDesc + artist.name,
              thumb_url: enteredArtistImageLink,
              photo_url: enteredArtistImageLink,
              input_message_content:{ message_text: enteredArtistText },
              reply_markup: {
                  inline_keyboard: enteredArtistKeyboard
              },
              parse_mode:"HTML"
          });

      if(artists.length === 0)
      {

          results.push({
              type: 'article',
              id: 'noRelatedArtists',
              title: noRelatedArtistsTitle,
              description: noRelatedArtistsDesc,
              input_message_content:{ message_text: noRelatedArtistsDesc },
              reply_markup: {
                  inline_keyboard: enteredArtistKeyboard
              },
          });

          ctx.answerInlineQuery(results, {cache_time: 0});
          return;
      }

      for (let i = 0; i < artists.length; i++) {
          var currentArtist = artists[i];

          var artistImageLink = getImageURL(currentArtist);

          var artistKeyboard = [
              [{text: devTGChannelText, url: "https://t.me/tupalinks"}]
          ];

          var currentArtistDesc = '';
          var currentArtistText = '';

          switch (lang)
          {
              case "ru":
                  currentArtistDesc = `Нажмите, что бы показать информацию о ${currentArtist.name}`;
                  currentArtistText = "Загрузка...";
                  break;
              case "uk":
                  currentArtistDesc = `Натисніть, щоб показати інформацію про ${currentArtist.name}`;
                  currentArtistText = "Завантаження...";
                  break;
              case "en":
                  currentArtistDesc = `Click to show info about ${currentArtist.name}`;
                  currentArtistText = "Loading...";
                  break;
          }

          results.push({
              type: 'article',
              id: 'artist_' + currentArtist.id + "_" + artist.id,
              thumb_url: artistImageLink,
              title: currentArtist.name,
              description: currentArtistDesc,
              input_message_content:{ message_text: currentArtistText },
              reply_markup: {
                  inline_keyboard: artistKeyboard
              },
              parse_mode:"HTML"
          });
      }

      ctx.answerInlineQuery(results, {cache_time: 0});
  }
    catch(err) {
        results.push({
            type: 'article',
            id: 'somethingWrong',
            title: unknownTitle,
            description: unknownDescription,
            input_message_content: {
                message_text: unknownMessage
            }
        });
        ctx.answerInlineQuery(results, {cache_time: 0});
    }
});

bot.on('chosen_inline_result', async ctx => {
    await setAccessToken();
    var inlineMessageID = ctx.update.chosen_inline_result.inline_message_id;

    var lang = await getUserLanguage(ctx.update.chosen_inline_result.from);

    var devTGChannelText = '';
    var openArtistProfileText = '';

    switch(lang)
    {
        case 'ru':
            devTGChannelText = "Открыть Telegram-канал разработчика";
            openArtistProfileText = 'Открыть профиль исполнителя в Spotify';
            break;
        case 'uk':
            devTGChannelText = "Відкрити Telegram-канал розробника";
            openArtistProfileText = 'Відкрити профіль виконавця в Spotify';
            break;
        case 'en':
            devTGChannelText = "Open the developer's Telegram-channel";
            openArtistProfileText = "Open artst profile in Spotify";
            break;
    }

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

            var topTracksStr = (await getArtistTopTracks(artist));

            var genres = getGeneralGenres(artist, undefined);

            artistKeyboard = [
                [{text: openArtistProfileText, url: artistLink}],
                [{text: devTGChannelText, url: "https://t.me/tupalinks"}]
            ];

            switch (lang)
            {
                case 'ru':
                    message = `Информация про ${artist.name}<a href="${artistImageLink}">🎵</a>:
          \nЖанры: ${genres}
          \nПодписчики: ${artist.followers.total}
          \n\nТоп-5 треков: \n${topTracksStr}`;
                    break;
                case 'uk':
                    message = `Інформація про ${artist.name}<a href="${artistImageLink}">🎵</a>:
          \nЖанри: ${genres}
          \nПідписники: ${artist.followers.total}
          \n\nТоп-5 треків: \n${topTracksStr}`;
                    break;
                case 'en':
                    message = `Information about ${artist.name}<a href="${artistImageLink}">🎵</a>:
          \nGenres: ${genres}
          \nFollowers: ${artist.followers.total}
          \n\nTOP-5 tracks: \n${topTracksStr}`;
                    break;
            }

        }
        else {
            var sendedArtistID = splitResult[2];
            var artistID = splitResult[1];

            var sendedArtist = (await spotifyApi.getArtist(sendedArtistID)).body;
            var artist = (await spotifyApi.getArtist(artistID)).body;

            var topTracksStr = (await getArtistTopTracks(artist));
            var generalGenres = getGeneralGenres(sendedArtist, artist);

            var sendedArtistLink = getArtistSpotifyLink(sendedArtist);

            var artistLink = getArtistSpotifyLink(artist);
            var artistImageLink = getImageURL(artist);

            artistKeyboard = [
                [{text: "Открыть профиль исполнителя в Spotify", url: artistLink}],
                [{text: "Открыть Telegram-канал разработчика", url: "https://t.me/tupalinks"}]
            ];

            switch (lang)
            {
                case 'ru':
                    message = `Запрос: ${sendedArtist.name}\nРезультат: ${artist.name}\n\nИнформация про ${artist.name}<a href="${artistImageLink}">🎵</a>:\n\nСовпадения с <a href="${sendedArtistLink}">${sendedArtist.name}</a> по жанрам: ${generalGenres}
          \nПодписчики: ${artist.followers.total}
          \n\nТоп-5 треков: \n${topTracksStr}`;
                    break;
                case 'uk':
                    message = `Запит: ${sendedArtist.name}\nРезультат: ${artist.name}\n\nІнформация про ${artist.name}<a href="${artistImageLink}">🎵</a>:\n\nЗбіги з <a href="${sendedArtistLink}">${sendedArtist.name}</a> по жанрам: ${generalGenres}
          \nПідписники: ${artist.followers.total}
          \n\nТоп-5 треків: \n${topTracksStr}`;
                    break;
                case 'en':
                    message = `Request: ${sendedArtist.name}\nResult: ${artist.name}\n\nInformation about ${artist.name}<a href="${artistImageLink}">🎵</a>:\n\nСoincidences with <a href="${sendedArtistLink}">${sendedArtist.name}</a> by genres: ${generalGenres}
          \nFollowers: ${artist.followers.total}
          \n\nTOP-5 tracks: \n${topTracksStr}`;
                    break;
            }
        }

        await bot.telegram.editMessageCaption(undefined, undefined, inlineMessageID, message, {parse_mode: "HTML"});
        await bot.telegram.editMessageReplyMarkup(undefined, undefined, inlineMessageID,
            {inline_keyboard: artistKeyboard});
    }
});

bot.help(async ctx => {
    var message = "";


    var lang = await getUserLanguage(ctx.update.message.from);

    switch (lang)
    {
        case 'ru':
            message = "Я работаю в inline-режиме, это означает что меня можно использовать в любом чате. Просто упомяните меня и напишите интересующего вас исполнителя, и я найду похожих." +
            "\nПример: <code>@findrelatedartistsbot верка сердючка</code>" +
            "\n\nТак же, если у вас не получается найти нужного исполнителя обычным поиском, то вы можете вставить ссылку на его профиль в Spotify" +
            "\nПример: <code>@findrelatedartistsbot https://open.spotify.com/artist/7uH6CJjqK71HlHW4WHNAJg?si=hfRfvepvQL26MEsG97W1Lw</code>" +
            "\n\nВы так же можете поменять язык бота на любой из трёх: Русский, Украинский, Английский, - написав команду /settings" +
            "\n\nЕсли у вас возникли какие то вопросы/проблемы, <a href='https://t.me/tupalinks'>свяжитесь с разработчиком</a>"
            break;
        case 'uk':
            message = "Я працюю у inline-режимі, це означає що мене можна використовувати у будь-якому чаті. Просто згадайте мене та напишіть виконавця який вас цікавить, і я знайду схожих." +
            "\nНаприклад: <code>@findrelatedartistsbot верка сердючка</code>" +
            "\n\nТакож, якщо у вас не виходить знайти потрібного виконавця зичайним пошуком, то ви можете вставити посилання на його профіль у Spotify" +
            "\nНаприклад: <code>@findrelatedartistsbot https://open.spotify.com/artist/7uH6CJjqK71HlHW4WHNAJg?si=hfRfvepvQL26MEsG97W1Lw</code>" +
            "\n\nВи також можете змінити мову бота на будь-яку з трьох: Українська, Англійська, російська, - написав команду /settings" +
            "\n\nЯкщо у вас з'явились якісь питання/проблеми, <a href='https://t.me/tupalinks'>зв'яжіться з розробником</a>"
            break;
        case 'en':
            message = "I work in inline mode, which means that I can be used in any chat. Just mention me and write the artist you are interested in, and I will find similar ones." +
            "\nExample: <code>@findrelatedartistsbot Verka Serduchka</code>" +
            "\n\nAlso, if you can't find the artist you're looking for with a simple search, you can paste a link to its Spotify profile" +
            "\nExample: <code>@findrelatedartistsbot https://open.spotify.com/artist/7uH6CJjqK71HlHW4WHNAJg?si=hfRfvepvQL26MEsG97W1Lw</code>" +
            "\n\n Also you can change bot language on any of the three: English, Ukrainian, russian, - by writing a command /settings" +
            "\n\nIf you have any questions/problems, <a href='https://t.me/tupalinks'>contact the developer</a>"
            break;
    }

  await bot.telegram.sendMessage(ctx.chat.id, message, {parse_mode: "HTML"});
})

bot.start(async ctx => {
    var message = '';

    var lang = await getUserLanguage(ctx.update.message.from);

    switch (lang)
    {
        case 'ru':
            message = "Привет! Я - бот, который поможет тебе найти похожих исполнителей.\n\nНапиши /help для большей информации."
            break;
        case 'uk':
            message = "Привіт! Я - бот, котрий допоможе тобі знайти схожих виконавців.\n\nНапиши /help для більшої інформації."
            break;
        case 'en':
            message = "Hi! I am a bot that will help you find similar artists.\n\nWrite /help for more information."
            break;
    }

  await bot.telegram.sendMessage(ctx.chat.id, message);
})

bot.command('settings', async ctx => {
    var message = "";

    var lang = await getUserLanguage(ctx.update.message.from);

    switch(lang)
    {
        case 'ru':
            message = "Выберите язык, на которых хотите переключиться";
            break;
        case 'uk':
            message = "Виберіть мову, на яку хочете перейти";
            break;
        case 'en':
            message = "Select the language you want to switch to";
            break;
    }

    var keyboard = [
        [{text: "🇺🇦", callback_data:"ua"}, {text: "🇬🇧", callback_data:"en"}, {text: "🇷🇺", callback_data:"ru"}, ]
    ];

    await bot.telegram.sendMessage(ctx.chat.id, message, {reply_markup: {inline_keyboard: keyboard}});
})

bot.action('ua', async ctx => {
   var lang = await getUserLanguage(ctx.update.callback_query.from);

   if(lang == 'uk')
   {
       await bot.telegram.sendMessage(ctx.chat.id, "Ця мова вже вибрана.");
       ctx.answerCbQuery();
       return;
   }

   await setUserLanguage(ctx.update.callback_query.from, 'uk');

    await bot.telegram.sendMessage(ctx.chat.id, "Мова успішно переключено на українську.");
    ctx.answerCbQuery();
});

bot.action('en', async ctx => {
   var lang = await getUserLanguage(ctx.update.callback_query.from);

   if(lang == 'en')
   {
       await bot.telegram.sendMessage(ctx.chat.id, "This language is already selected.");
       ctx.answerCbQuery();
       return;
   }

   await setUserLanguage(ctx.update.callback_query.from, 'en');

    await bot.telegram.sendMessage(ctx.chat.id, "Language is changed successfully.");
    ctx.answerCbQuery();
});

bot.action('ru', async ctx => {
   var lang = await getUserLanguage(ctx.update.callback_query.from);

   if(lang == 'ru')
   {
       await bot.telegram.sendMessage(ctx.chat.id, "Этот язык уже выбран.");
       ctx.answerCbQuery();
       return;
   }

   await setUserLanguage(ctx.update.callback_query.from, 'ru');

    await bot.telegram.sendMessage(ctx.chat.id, "Язык успешно переключено.");
    ctx.answerCbQuery();
});

bot.launch();

//require('http').createServer((req, res) => res.end('Bot is alive!')).listen(3000)