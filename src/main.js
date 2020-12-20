const fs = require('fs')
const puppeteer = require('puppeteer')

const START_PAGE = 'https://lannuaire.service-public.fr/navigation/sie'

let browser

/**
 * @param {string} url 
 * @return {puppeteer.Page}
 */
const createPage = async(url) => {
    const result = await browser.newPage()
    await result.goto(url, {waitUntil : 'domcontentloaded'})
    return result
}

/**
 * @param {puppeteer.Page} page
 * @return {boolean} 
 */
const hasNextPage = async (page) => {
    let result =  await page.$('ul.pagination li.next')
    return result !== null
}

/**
 * 
 * @param {puppeteer.Page} page
 * @returns {puppeteer.Page} 
 */
const goToNextPage = async page => {
    const nextPageUrl = await page.$eval('ul.pagination li.next a', (link) => {
        return link.href
    })
    await page.goto(nextPageUrl, {waitUntil : 'domcontentloaded'})

    return page
}

/**
 * 
 * @param {puppeteer.Page} page
 * @return {Array.<object>} 
 */
const getSIEData = async (page) => {
    let result = {}

    result.name = await page.$eval('h1#contentTitle', (element) =>  element.textContent)

    try {
        result.email = await page.$eval('#contentContactEmail span[itemprop="email"] a', (element) => element.textContent)
    } catch (e) {
        if (e.message.includes('failed to find element matching selector')) {
            result.email = null
        } else {
            throw e
        }
    }
    result.phone = await page.$eval('#contentPhone_1', (element) => element.textContent)

    result.address = await page.$eval('article div[itemtype="http://schema.org/PostalAddress"] span[itemprop="streetAddress"]', (element) => element.textContent)
    result.city = await page.$eval('article div[itemtype="http://schema.org/PostalAddress"] span[itemprop="addressLocality"]', (element) => element.textContent)
    result.postal_code = await page.$eval('article div[itemtype="http://schema.org/PostalAddress"] span[itemprop="postalCode"]', (element) => element.textContent)

    result.full_address = `${result.address}, ${result.postal_code}, ${result.city}`

    return result

}

const waitFor = (duration) => {
    return new Promise(resolve => {
        setTimeout(resolve, duration)
    })
}

/**
 * @param {puppeteer.Page} page
 * @return {Array.<string>}
 */
const listSIEOnPage = async (page) => {
    return await page.$$eval('ul.list-orga li a', (links) => {
        return links.map(link => link.href)
    })
}

(async() => {
    browser = await puppeteer.launch()
    let mainPage = await createPage(START_PAGE)

    let isDone = false

    let result = []
    while (!isDone) {
        const links = await listSIEOnPage(mainPage)

        for (let i = 0; i < links.length; i++) {
            const link = links[i]

            console.log(link)

            const siePage = await createPage(link)
            const sieData = await getSIEData(siePage)
            siePage.close()

            console.log(sieData)
            await waitFor(2000)

            result.push(sieData)
        }

        isDone = !await hasNextPage(mainPage)

        if (!isDone) {
            mainPage = await goToNextPage(mainPage)
        }

    }
    
    const json = JSON.stringify(result)
    fs.writeFile('./sie.json', json, 'utf8', function(err){
        if(err){ 
            console.log(err) 
        }
    })
})()