const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const Url = require('url');

exports.unfurl = async (req, res) => {
    let origin;
    try {
        origin = Url.parse(req.get('origin'));
    } catch (e) { }
    let secretKey = req.get('secret-key');
    if (!(origin && origin.hostname === process.env.HOSTNAME && secretKey === process.env.SECRET_KEY)) {
        return res.status(403).send('Unauthorized');
    }

    const url = getUrl(req);
    if (!url || !url.hostname) {
        console.error('Valid URL to unfurl not specified')
        return res.status(400).send('Please specify a valid URL to unfurl');
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        const page = await browser.newPage();

        await page.goto(url.href, {
            'waitUntil': 'networkidle0'
        });

        let unfurlResonse = await page.evaluate(() => {
            let resBody = {
                OEmbed: {},
                OGraph: {},
                Twitter: {}
            };
            // let oEmbed = document.querySelector('link[type*="oembed"]');
            // if (oEmbed) {
            //     let OEmbedResponse = await fetch(oEmbed.href);
            //     console.log('oEMBED:', OEmbedResponse.ok)
            //     if (OEmbedResponse.ok) {
            //         resBody.OEmbed = OEmbedResponse.json();
            //     }
            // }

            var oGraph = document.querySelectorAll('meta[property^="og:"]');
            if (oGraph.length > 0) {
                oGraph.forEach(element => {
                    if (element.attributes.property.value.indexOf('title') > 0) {
                        resBody.OGraph.Title = element.attributes.content.value;
                    } else if (element.attributes.property.value.indexOf('description') > 0) {
                        resBody.OGraph.Description = element.attributes.content.value;
                    } else if (element.attributes.property.value === 'og:image') {
                        resBody.OGraph.Image = element.attributes.content.value;
                    }
                });
            }

            var twitter = document.querySelectorAll('meta[property^="twitter:"]');
            if (twitter.length > 0) {
                twitter.forEach(element => {
                    if (element.attributes.property.value.indexOf('title') > 0) {
                        resBody.Twitter.Title = element.attributes.content.value;
                    } else if (element.attributes.property.value.indexOf('description') > 0) {
                        resBody.Twitter.Description = element.attributes.content.value;
                    } else if (element.attributes.property.value === 'twitter:image') {
                        resBody.Twitter.Image = element.attributes.content.value;
                    }
                });
            }

            return resBody;
        });

        res.status(200).send(unfurlResonse);
    } catch (e) {
        console.error('Caught Error: ' + e);
        res.status(500).send(e);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

function getUrl(req) {
    if (req.query.url || req.body.url) {
        return Url.parse(req.query.url || req.body.url);
    }
    try {
        return Url.parse(JSON.parse(req.body).url);
    } catch (e) { }
}