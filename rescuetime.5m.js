#!/usr/bin/env /usr/local/bin/node

// <bitbar.title>RescueTime Productivity Stats</bitbar.title>
// <bitbar.version>v1.1</bitbar.version>
// <bitbar.author>Mullwar</bitbar.author>
// <bitbar.author.github>mullwar</bitbar.author.github>
// <bitbar.desc>Show RescueTime Productivity in menubar</bitbar.desc>
// <bitbar.image>https://i.imgur.com/7ShrdlB.png</bitbar.image>
// <bitbar.dependencies>node</bitbar.dependencies>
// <bitbar.abouturl>https://github.com/mullwar/bitbar-plugins</bitbar.abouturl>

"use strict";

/* jshint -W100 */
/* jshint esversion: 6 */

const https = require('https');
const fs = require('fs');

// Rescue time API key. Need to manually create an api.key file
const PATH = `${process.env.HOME}/Library/RescueTime.com/api.key`;
const API_KEY = fs.readFileSync(PATH, 'utf8').trim();

const ENDPOINT_FEED = 'https://www.rescuetime.com/anapi/daily_summary_feed.json';
const ENDPOINT_ACTIVITIES = 'https://www.rescuetime.com/anapi/data.json';

const URL_DASH_DAY = 'https://www.rescuetime.com/dashboard/for/the/day/of/';

let endpoint_week = `${ENDPOINT_FEED}?key=${API_KEY}`;
// Note &restrict_schedule_id=6839529, it restricts to 'work' schedule: https://www.rescuetime.com/dashboard?schedule_id=6839529
let endpoint_today = `${ENDPOINT_ACTIVITIES}?key=${API_KEY}&perspective=interval&restrict_kind=productivity&restrict_schedule_id=6839529`;


function request(endpoint) {
  return new Promise((resolve, reject) => {
    https.get(endpoint, (res) => {
      const body = [];
      res.on('data', (data) => body.push(data));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body.join()));
        } catch(error) {
          reject(error);
        }
      });
      res.on('error', (error) => {
        reject(error);
      });
    });
  });
}

function getDayOfWeek(date) {
  const dateObj = new Date(date);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dateObj.getDay()];
}

function getColorFromScore(score) {
  return (score >= 69 ? 'lightgreen' : 'red');
}

function getTickOrCross(score) {
  return (score >= 3 ? '✅' : '❌');
}

function hoursToString(hoursDecimal) {
  const hours = Math.floor(hoursDecimal);
  let minutes = Math.round((hoursDecimal - hours) * 60);

  if (minutes < 10) {minutes = "0"+minutes;}
  return `${hours.toString()}:${minutes.toString()}`;
}

function filterRowsByProductivity(rows, index) {
  // Index 3 correspondes to productivity
  // 2: v productive; 1: productive; 0: neutral; -1: distracting; -2: v distracting
  return rows.filter((row => row[3] == index))
}

function sumHoursinRows(rows) {
  // Index 1 corresponds to time in seconds
  return rows.reduce((acc, row) => (acc + row[1] / 60 / 60), 0);
}


//Get rows of activity data from anapi/data
request(endpoint_today).then((json) => {
  // Sum time logged today (in hours)
  const today_hours = sumHoursinRows(json.rows);

  const vpRows = filterRowsByProductivity(json.rows, 2);
  const vpHours = sumHoursinRows(vpRows);

  const pRows = filterRowsByProductivity(json.rows, 1);
  const pHours = sumHoursinRows(pRows);

  const nRows = filterRowsByProductivity(json.rows, 0);
  const nHours = sumHoursinRows(nRows);
  
  const dRows = filterRowsByProductivity(json.rows, -1);
  const dHours = sumHoursinRows(dRows);
  
  const vdRows = filterRowsByProductivity(json.rows, -2);
  const vdHours = sumHoursinRows(vdRows);

  let score = 0;
  if (today_hours !== 0) {
    score = Math.floor((1*vpHours + .75*pHours + .5*nHours + .25*dHours + 0*vdHours)/today_hours*100);
  }

  //console.log(`🎯${score}  (${hoursToString(vpHours)} of ${hoursToString(today_hours)}) | color=${getColorFromScore(score)}`);
  console.log(`${score}%  | color=${getColorFromScore(score)}`);
  console.log(`---`);
  console.log(`${getTickOrCross(vpHours)} Today: ${score}% | href=https://www.rescuetime.com/dashboard color=black`);
  console.log(`${hoursToString(vpHours)} of ${hoursToString(today_hours)} (${Math.round(vpHours/today_hours*100)}%)`)
  console.log(`---`);
}).catch((error) => {
  console.log(error);
})

// Get this week's productivity data
request(endpoint_week).then((json) => {
  // Determine day of week for first entry of array
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const data_thisWeek = json.slice(0, 6); // Slice works differently in node vs. with BitBar. In BitBar, slice removes end index.

  data_thisWeek.forEach((data_day) => {
    console.log(`${getTickOrCross(data_day.very_productive_hours)} ${getDayOfWeek(data_day.date)}: ${data_day.productivity_pulse}% | href=${URL_DASH_DAY}${data_day.date} color=black`)
    console.log(`${hoursToString(data_day.very_productive_hours)} of ${hoursToString(data_day.total_hours)} (${data_day.very_productive_percentage}%)`)
    console.log(`---`)
  })
}).catch((error) => {
  console.log(error)
})