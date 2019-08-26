#!/usr/bin/env /usr/local/bin/node

// <bitbar.title>People In Space</bitbar.title>
// <bitbar.version>v1.1</bitbar.version>
// <bitbar.author>Mullwar</bitbar.author>
// <bitbar.author.github>mullwar</bitbar.author.github>
// <bitbar.desc>How many people are in Space right now?</bitbar.desc>
// <bitbar.image>http://i.imgur.com/i9biB3R.png</bitbar.image>
// <bitbar.dependencies>node</bitbar.dependencies>
// <bitbar.abouturl>https://github.com/mullwar/bitbar-plugins</bitbar.abouturl>

"use strict";

/* jshint -W100 */
/* jshint esversion: 6 */

const https = require('https');
const fs = require('fs');

// Rescue time API key. Need to manually create an api.key file
const path = `${process.env.HOME}/Library/RescueTime.com/api.key`;
const API_KEY = fs.readFileSync(path, 'utf8').trim();

// const ENDPOINT_PULSE = 'https://www.rescuetime.com/anapi/current_productivity_pulse.json';
const ENDPOINT_FEED = 'https://www.rescuetime.com/anapi/daily_summary_feed.json';
const ENDPOINT_ACTIVITIES = 'https://www.rescuetime.com/anapi/data.json';

const URL_DASH_DAY = 'https://www.rescuetime.com/dashboard/for/the/day/of/';

// const endpoint_pulse = `${ENDPOINT_PULSE}?key=${API_KEY}`;
const endpoint_week = `${ENDPOINT_FEED}?key=${API_KEY}`;
const endpoint_today = `${ENDPOINT_ACTIVITIES}?key=${API_KEY}&perspective=interval&restrict_kind=productivity`;

console.log(endpoint_today)

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

function getDayofWeekIndex(date) {
  const dateObj = new Date(date);
  return dateObj.getDay();
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
  const vp_hours = sumHoursinRows(vpRows);

  const pRows = filterRowsByProductivity(json.rows, 1);
  const p_hours = sumHoursinRows(pRows);

  const nRows = filterRowsByProductivity(json.rows, 0);
  const n_hours = sumHoursinRows(nRows);
  
  const dRows = filterRowsByProductivity(json.rows, -1);
  const d_hours = sumHoursinRows(dRows);
  
  const vdRows = filterRowsByProductivity(json.rows, -2);
  const vd_hours = sumHoursinRows(vdRows);

  // console.log(vd_hours);
  let score = 0;

  if (today_hours !== 0) {
    score = Math.floor((1*vp_hours + .75*p_hours + .5*n_hours + .25*d_hours + 0*vd_hours)/today_hours*100);
  }

  console.log(`🎯${score}  (${hoursToString(vp_hours)} of ${hoursToString(today_hours)}) | color=black`);
  console.log(`---`);

  console.log(`✅ Today: ${score} | href=https://www.rescuetime.com/dashboard color=black`);
  console.log(`${hoursToString(vp_hours)} of ${hoursToString(today_hours)} (${Math.round(vp_hours/today_hours*100)}%)`)
  console.log(`---`);

}).catch((error) => {
  console.log(error);
})

// // Get current productivity pulse
// request(endpoint_pulse).then((json) => {
//   if (json.pulse !== null) {
//     console.log(`🎯${json.pulse} | color=${json.color}`);
//     console.log(`---`);
//   } else {
//     console.log(`🎯-`);
//     console.log(`---`);
//   }
// }).catch((error) => {
//   console.log(error);
// })

// Get this week's productivity data
request(endpoint_week).then((json) => {
  // Determine day of week for first entry of array
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  const yesterdayIndex = getDayofWeekIndex(json[0].date);
  // console.log(`Yesterday index is ${yesterdayIndex}`);

  // If yesterday was a Sunday (i.e. today is Monday), there is no history to retrieve
  if (yesterdayIndex !== 6) {    
    const data_thisWeek = json.slice(0, yesterdayIndex + 1); // Slice works differently in node vs. with BitBar. In BitBar, slice removes end index.

    data_thisWeek.forEach((data_day) => {
      console.log(`❌ ${days[getDayofWeekIndex(data_day.date) + 1]}: ${data_day.productivity_pulse} | href=${URL_DASH_DAY}${data_day.date} color=black`)
      console.log(`${hoursToString(data_day.very_productive_hours)} of ${hoursToString(data_day.total_hours)} (${data_day.very_productive_percentage}%)`)
      console.log(`---`)
    })
  }

}).catch((error) => {
  console.log(error)
})