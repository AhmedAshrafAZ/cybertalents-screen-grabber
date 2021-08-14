'use strict';
const inquirer = require('inquirer');
const fs = require('fs');
const cliProgress = require('cli-progress');
const machine_type = process.platform;
const fileSeparator = () => {
  return machine_type === 'win32' ? '\\' : '/';
};

const print = (text, clearLine) => {
  if (clearLine) process.stdout.clearLine();
  process.stdout.write(text);
};

const getAvailableCourses = async (page) => {
  return await page.evaluate(() => {
    const courses = [];
    document.querySelectorAll('.course-card > .card-body > .card-title').forEach((element) => {
      const parent = element.parentElement.parentElement;
      courses.push({ name: element.textContent.trim(), url: parent.children[parent.childElementCount - 1].children[1].href });
    });
    return courses;
  });
};

const getAnswers = async (availableCourses) => {
  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      message: 'Select the courses you want',
      name: 'courses',
      choices: availableCourses,
      validate(answer) {
        if (answer.length < 1) {
          return 'You must choose at least one course.';
        }
        return true;
      },
      loop: false,
    },
  ]);
  return answers.courses.map((course) => {
    return {
      name: course,
      url: availableCourses.find((c) => c.name === course).url,
    };
  });
};

const loadingBar = new cliProgress.MultiBar(
  {
    format: `Capturing ({value}/{total}): {title} | [{bar}] | ETA: {eta}s `,
    barCompleteChar: '#',
    barIncompleteChar: '.',
    hideCursor: true,
    clearOnComplete: true,
  },
  cliProgress.Presets.legacy
);

const getLessons = async (page, courses) => {
  for (let index = 0; index < courses.length; index++) {
    await page.goto(courses[index].url, {
      waitUntil: 'networkidle2',
    });
    courses[index].lessons = await page.evaluate(() => {
      const lessons = [];
      const lessonsContainer = document.querySelectorAll('[class="competition-name ml-8 w-full"]');
      lessonsContainer.forEach((les) => {
        let name = les.textContent.trim().replaceAll('-', '- ');
        name = name.substring(0, name.indexOf('(')).trim();
        lessons.push({
          name: name,
          url: les.parentElement.parentElement.parentElement.href,
        });
      });
      return lessons;
    });
  }
  return courses;
};

const saveLessons = async (page, courses) => {
  for (let index = 0; index < courses.length; index++) {
    const coursePath = `${__dirname}${fileSeparator()}CyberTalentsLearn${fileSeparator()}${index + 1}- ${courses[index].name}${fileSeparator()}`;
    const lessonsBar = loadingBar.create(courses[index].lessons.length + 1, 1, {
      title: courses[index].name,
    });
    for (let i = 0; i < courses[index].lessons.length; i++) {
      await page.goto(courses[index].lessons[i].url, {
        waitUntil: 'networkidle2',
      });
      const lessonName = courses[index].lessons[i].name;
      const lessonPath = `${coursePath}${lessonName}${fileSeparator()}`;
      fs.mkdirSync(lessonPath, { recursive: true });
      await page.evaluate(() => {
        document.getElementById('stu').style.display = 'none';
        document.getElementsByTagName('footer')[0].style.display = 'none';
        document.getElementsByClassName('go2top')[0].style.display = 'none';
      });
      await page.screenshot({
        path: `${lessonPath}lesson.png`,
        fullPage: true,
      });
      await saveChallenges(page, courses[index].lessons[i], lessonPath);
      lessonsBar.increment();
    }
    loadingBar.remove(lessonsBar);
  }
  loadingBar.stop();
};

const getChallenges = async (page, url) => {
  await page.goto(url, {
    waitUntil: 'networkidle2',
  });
  return await page.evaluate(() => {
    const challenges = [];
    document.querySelectorAll('[class="card flex mb-4 challenge-card"]').forEach((element) => {
      challenges.push({
        name: element.children[0].children[0].children[0].children[0].text.trim(),
        level: element.children[0].children[0].children[1].children[1].textContent.trim(),
        url: element.children[0].children[0].children[0].children[0].href,
      });
    });
    return challenges;
  });
};

const saveChallenges = async (page, lesson, lessonPath) => {
  const challenges = await getChallenges(page, `${lesson.url}/challenges`);
  fs.mkdirSync(`${lessonPath}challenges${fileSeparator()}`, { recursive: true });
  const challengesBar = loadingBar.create(challenges.length + 1, 1, {
    title: 'challenge',
  });
  for (let i = 0; i < challenges.length; i++) {
    const challengePath = `${lessonPath}challenges${fileSeparator()}[${challenges[i].level.substring(challenges[i].level.indexOf(':') + 1).trim()}] ${challenges[i].name}${fileSeparator()}`;
    fs.mkdirSync(challengePath, { recursive: true });

    // Save Challenge
    await page.goto(challenges[i].url, {
      waitUntil: 'networkidle2',
    });
    await page.evaluate(() => {
      document.getElementById('stu').style.display = 'none';
      document.getElementsByTagName('footer')[0].style.display = 'none';
      document.getElementsByClassName('go2top')[0].style.display = 'none';
      const solved = document.querySelectorAll('[class="text-success fa fa-check-circle"]')[0] || undefined;
      if (solved) document.querySelectorAll('[class="text-success fa fa-check-circle"]')[0].style.display = 'none';
    });
    await page.screenshot({
      path: `${challengePath}challenge.png`,
      fullPage: true,
    });

    // Save Writeup
    await page.goto(`${challenges[i].url}/writeups`, {
      waitUntil: 'networkidle2',
    });
    await page.evaluate(() => {
      document.getElementById('stu').style.display = 'none';
      document.getElementsByTagName('footer')[0].style.display = 'none';
      document.getElementsByClassName('go2top')[0].style.display = 'none';
    });
    await page.screenshot({
      path: `${challengePath}writeup.png`,
      fullPage: true,
    });
    challengesBar.increment();
  }
  loadingBar.remove(challengesBar);
};

module.exports = { print, getAvailableCourses, getAnswers, getLessons, saveLessons, getChallenges, saveChallenges };
