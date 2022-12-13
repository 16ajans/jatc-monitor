import 'dotenv/config'
import { Builder, By, Key, until } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'
import nodemailer from 'nodemailer'
import fs from 'fs'
import cron from 'node-cron'

var logger = fs.createWriteStream('log.txt', {
    flags: 'a'
})

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
        user: process.env.SENDER_GMAIL,
        pass: process.env.GMAIL_APP_PASSWD,
    },
})

transporter.verify(function (error, success) {
    if (error) {
        console.log(error)
        process.exit(1)
    } else {
        console.log("Transporter is ready to take messages.")
        task.start();
        console.log("Cron job started.")
    }
})

if (!cron.validate(process.env.CRON)) {
    console.log("Cron string is invalid.")
    process.exit(1)
} else {
    console.log('Cron job readied for ' + process.env.CRON)
}

let task = cron.schedule(process.env.CRON, async () => {
    try {
        const driver = new Builder()
            .forBrowser("chrome")
            .setChromeOptions(new chrome.Options().headless())
            .build()

        await driver.get('https://secure2.tradeschoolinc.com/v5/psejatc-org/login/index.php')
        await driver.findElement(By.id('loginemail')).sendKeys(process.env.JATC_EMAIL)
        await driver.findElement(By.id('loginpassword')).sendKeys(process.env.JATC_PASSWD)
        const re = /\d+/g
        const captchaChallenge = await driver.findElement(By.css('form > div')).getText()
        let numbers = captchaChallenge.match(re)
        const captchaSolution = Number(numbers[0]) + Number(numbers[1])
        await driver.findElement(By.id('captcha')).sendKeys(captchaSolution, Key.ENTER)

        const button = await driver.wait(until.elementLocated(By.name('applications')), 30000)
        await button.click()

        const table = await driver.wait(until.elementLocated(By.id('applications')), 30000)
        const rank = await table.findElement(By.css('tr:last-child > td:nth-child(7)')).getText()

        await driver.quit()

        let info = await transporter.sendMail({
            to: 'alexjansen210@gmail.com',
            text: 'You are currently at position ' + rank + '.',
            subject: 'PSEJATC Rank Update'
        })
        let msg = new Date().toISOString() + " " + rank + "\n"

        logger.write(msg)
        console.log(msg)
    }
    catch (e) {
        let info = await transporter.sendMail({
            to: 'alexjansen210@gmail.com',
            text: e.stack,
            subject: 'PSEJATC Rank Update Error'
        })
    }
}, {
    scheduled: false
})