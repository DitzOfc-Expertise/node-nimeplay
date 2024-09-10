const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const inquirer = require('inquirer');
const path = require('path');
const open = require('open');

const app = express();
const PORT = 3000;
const BASE_URL = "https://v5.animasu.cc/?s=";


async function searchAnime(query) {
    try {
        const { data } = await axios.get(BASE_URL + encodeURIComponent(query));
        const $ = cheerio.load(data);

        const results = [];
        $('.bs').each((i, elem) => {
            const title = $(elem).find('.tt').text().trim();
            const link = $(elem).find('a').attr('href');
            const imgSrc = $(elem).find('img').attr('src');
            const episodes = $(elem).find('.epx').text().trim();
            const status = $(elem).find('.sb').text().trim();

            results.push({
                title,
                link,
                imgSrc,
                episodes,
                status
            });
        });

        return results;
    } catch (error) {
        console.error('Error fetching data:', error);
        return [];
    }
}

async function fetchEpisodeLinks(animeUrl) {
    try {
        const { data } = await axios.get(animeUrl);
        const $ = cheerio.load(data);

        const episodes = [];
        $('#daftarepisode li').each((i, elem) => {
            const episodeLink = $(elem).find('a').attr('href');
            const episodeTitle = $(elem).find('a').text().trim();
            episodes.push({
                title: episodeTitle,
                link: episodeLink
            });
        });

        return episodes;
    } catch (error) {
        console.error('Error fetching episode data:', error);
        return [];
    }
}

async function fetchStreamUrl(episodeUrl) {
    try {
        const { data } = await axios.get(episodeUrl);
        const $ = cheerio.load(data);

        const iframeSrc = $('#pembed iframe').attr('src');
        return iframeSrc;
    } catch (error) {
        console.error('Error fetching stream URL:', error);
        return null;
    }
}

app.get('/watch', async (req, res) => {
    const episodeUrl = req.query.url;

    if (!episodeUrl) {
        return res.status(400).send('URL episode tidak disediakan.');
    }

    const streamUrl = await fetchStreamUrl(episodeUrl);

    if (streamUrl) {
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Streaming</title>
                <style>
                    body {
                        margin: 0;
                        font-family: Arial, sans-serif;
                        background-color: #222;
                        color: #fff;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        overflow: hidden;
                    }
                    .video-container {
                        position: relative;
                        width: 100%;
                        max-width: 90vw;
                        max-height: 80vh;
                        border: 5px solid #444;
                        border-radius: 8px;
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
                        background-color: #000;
                    }
                    iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                        border-radius: 8px;
                    }
                    @media (max-width: 600px) {
                        .video-container {
                            max-width: 100vw;
                            max-height: 60vh;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="video-container">
                    <iframe src="${streamUrl}" allowfullscreen></iframe>
                </div>
            </body>
            </html>
        `);
    } else {
        res.status(500).send('Gagal mendapatkan URL streaming.');
    }
});

async function main() {
    try {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'query',
                message: 'Masukkan judul anime yang ingin ditonton:',
            }
        ]);

        const results = await searchAnime(answers.query);

        if (results.length === 0) {
            console.log('Tidak ada hasil ditemukan.');
        } else {
            const choices = results.map((result, index) => ({
                name: `${result.title} (${result.episodes} - ${result.status})`,
                value: result
            }));

            const selectedAnime = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'anime',
                    message: 'Pilih anime untuk melihat episode:',
                    choices: choices
                }
            ]);

            const episodes = await fetchEpisodeLinks(selectedAnime.anime.link);

            if (episodes.length > 0) {
                const episodeChoices = episodes.map((episode, index) => ({
                    name: episode.title,
                    value: episode.link
                }));

                const selectedEpisode = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'episode',
                        message: 'Pilih episode untuk ditampilkan:',
                        choices: episodeChoices
                    }
                ]);

                const streamingUrl = `http://localhost:${PORT}/watch?url=${encodeURIComponent(selectedEpisode.episode)}`;
                console.log(`Membuka link streaming: ${streamingUrl}`);
                open(streamingUrl);
            } else {
                console.log('Tidak ada episode ditemukan.');
            }
        }
    } catch (error) {
        console.error('Terjadi kesalahan:', error);
    }
}

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    main();
});