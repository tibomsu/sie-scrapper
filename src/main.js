const fs = require('fs')
const puppeteer = require('puppeteer')

const START_PAGE = 'https://lannuaire.service-public.fr/navigation/sie'

/**
 * 
 * @param {puppeteer.Page} page
 * @return {Promise<object>} 
 */
const getSIEData = async (page) => {
    let taxService = {}

    taxService.name = await page.$eval('h1#contentTitle', (element) =>  element.textContent.trim())

    try {
        taxService.email = await page.$eval('#contentContactEmail span[itemprop="email"] a', (element) => element.textContent.trim())
    } catch (e) {
        if (e.message.includes('failed to find element matching selector')) {
            taxService.email = null
        } else {
            throw e
        }
    }
    taxService.phone = await page.$eval('#contentPhone_1', (element) => element.textContent.trim())

    taxService.address = await page.$eval('article div[itemtype="http://schema.org/PostalAddress"] span[itemprop="streetAddress"]', (element) => element.textContent.trim())
    taxService.city = await page.$eval('article div[itemtype="http://schema.org/PostalAddress"] span[itemprop="addressLocality"]', (element) => element.textContent.trim())
    taxService.postal_code = await page.$eval('article div[itemtype="http://schema.org/PostalAddress"] span[itemprop="postalCode"]', (element) => element.textContent.trim())

    taxService.full_address = `${taxService.address}, ${taxService.postal_code}, ${taxService.city}`

    return taxService
}

/**
 * @param {puppeteer.Page} page
 * @return {Promise<Set<object>>}
 */
const listTaxServices = async(page) => {
    const taxServicesUrls = await listTaxServicesUrls(page)

    let taxServices = new Set()

    for(const url of taxServicesUrls) {
        await page.goto(url, {waitUntil: 'domcontentloaded'})

        const data = await getSIEData(page)
        data.url = url

        console.log(data.name)

        taxServices.add(data)
    }

    return taxServices
}

/**
 * @param {puppeteer.Page} page
 * @return {Promise<Set<string>>} 
 */
const listTaxServicesUrls = async(page) => {
    await page.goto(START_PAGE, {waitUntil: 'domcontentloaded'})
    let shouldContinue = true

    let urls = new Set()
    while(shouldContinue) {
        const newUrls = await page.$$eval('ul.list-orga li a', (links) => {
            return links.map(link => link.href)
        })
        newUrls.forEach(url => {
            urls.add(url)
        })

        shouldContinue = (await page.$('ul.pagination li.next')) !== null

        if (shouldContinue) {
            const nextUrl = await page.$eval('ul.pagination li.next a', (link) => {
                return link.href
            })
            await page.goto(nextUrl, {waitUntil: 'domcontentloaded'})
        }
    }

    return urls
}

(async() => {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()

    page.setRequestInterception(true)

    page.on('request', (request) => {
        if (request.resourceType() === 'document') {
            return request.continue()
        }
        return request.abort()
    })

    const taxServices = await listTaxServices(page)

    await page.close()
    await browser.close()

    fs.writeFile('./sie.json', JSON.stringify(Array.from(taxServices)), 'utf8', () => {})
})()