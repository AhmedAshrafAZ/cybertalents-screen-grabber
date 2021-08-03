'use strict';
require('dotenv').config();
const { getAvailableCourses, getAnswers, getLessons, saveLessons } = require('./scraper.js');
const puppeteer = require('puppeteer');

const userAuthData = {
  loginfield: process.env.CT_USERNAME,
  password: process.env.CT_PASSWORD,
};

const initBrowser = async () => {
  const puppOptions = {
    headless: true,
    timeout: 100000,
  };
  const browser = await puppeteer.launch(puppOptions);
  const page = await browser.newPage();
  page.setViewport({
    height: 720,
    width: 1280,
    deviceScaleFactor: 2,
  });
  await page.goto('https://cybertalents.com/login', {
    waitUntil: 'networkidle2',
  });
  page.setDefaultNavigationTimeout(0);
  return page;
};

const performLogin = async (page) => {
  await page.type('[name="loginfield"]', userAuthData.loginfield);
  await page.type('[name="password"]', userAuthData.password);
  await page.click('[type="submit"]');
  await page.waitForNavigation();

  await page.goto('https://cybertalents.com/learn', {
    waitUntil: 'networkidle2',
  });
};

(async () => {
  const page = await initBrowser();
  await performLogin(page);
  const availableCourses = await getAvailableCourses(page);
  let selectedCourses = await getAnswers(availableCourses);
  selectedCourses = await getLessons(page, selectedCourses);
  await saveLessons(page, selectedCourses);
  await browser.close();
})();
