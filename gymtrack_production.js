const express = require('express');
const twilio = require('twilio');
const bodyParser = require('body-parser');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

const CONFIG = {
  JULIAN_PHONE: '+573214709668',
  TIMEZONE: 'America/Bogota',
  MORNING_ALERT_TIME: '08:00',
};

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const ROUTINES = {
  0: { day: 'SUNDAY', name: '🦵 HEAVY LEG DAY', exercises: [
    { name: 'Smith Machine Squat', target: '4×8 @ 135 lbs' },
    { name: 'Barbell Romanian Deadlift', target: '4×8 @ 115 lbs' },
    { name: 'Machine Leg Press (Wide Stance)', target: '4×10 @ 180 lbs' },
    { name: 'Barbell Hip Thrust', target: '4×8 @ 135 lbs' }
  ]},
  1: { day: 'MONDAY', name: '🔵 BACK & TRICEPS', exercises: [
    { name: 'Cable Front Lat Pulldown (Close Grip)', target: '4×10 @ 100 lbs' },
    { name: 'T Bar Row', target: '4×8 @ 155 lbs' },
    { name: 'Cable Rope Face Pull', target: '3×15 @ 60 lbs' },
    { name: 'Cable Tricep Pushdown (Rope)', target: '4×10 @ 30 lbs' },
    { name: 'Machine Seated Tricep Dip', target: '4×12 @ 100 lbs' }
  ]},
  2: { day: 'TUESDAY', name: '💪 CHEST & BICEPS', exercises: [
    { name: 'Barbell Bench Press', target: '4×8 @ 105 lbs' },
    { name: 'Dumbbell Incline Bench Press', target: '4×8 @ 40 lbs' },
    { name: 'Machine Fly', target: '4×10 @ 100 lbs' },
    { name: 'Dumbbell Alternating Bicep Curl', target: '3×12 @ 15 lbs' },
    { name: 'Preacher Curl Machine', target: '3×12 @ 35 lbs' }
  ]},
  3: { day: 'WEDNESDAY', name: '🏊 SWIMMING', exercises: [
    { name: 'Swimming - 30-45 min', target: 'Cardio day' }
  ]},
  4: { day: 'THURSDAY', name: '🦵 LIGHT LOWER', exercises: [
    { name: 'Smith Machine Squat', target: '3×8 @ 125 lbs' },
    { name: 'Barbell Romanian Deadlift', target: '3×8 @ 105 lbs' },
    { name: 'Machine Leg Press (Wide Stance)', target: '3×10 @ 170 lbs' }
  ]},
  5: { day: 'FRIDAY', name: '💪 LIGHT UPPER', exercises: [
    { name: 'Barbell Bench Press', target: '3×8 @ 95 lbs' },
    { name: 'Cable Front Lat Pulldown (Close Grip)', target: '4×10 @ 100 lbs' },
    { name: 'Dumbbell Lateral Raise', target: '3×12 @ 15 lbs' },
    { name: 'Dumbbell Alternating Bicep Curl', target: '3×12 @ 15 lbs' }
  ]},
  6: { day: 'SATURDAY', name: '🏊 SWIMMING', exercises: [
    { name: 'Swimming - 30-45 min', target: 'Cardio day' }
  ]}
};

function getTodayRoutine() {
  return ROUTINES[new Date().getDay()];
}

function extractExerciseFromMessage(message) {
  const keywords = {
    'bench': 'Barbell Bench Press',
    'squat': 'Smith Machine Squat',
    'rdl': 'Barbell Romanian Deadlift',
    'leg press': 'Machine Leg Press (Wide Stance)',
    'lat pulldown': 'Cable Front Lat Pulldown (Close Grip)',
    'tricep': 'Cable Tricep Pushdown (Rope)',
    'curl': 'Dumbbell Alternating Bicep Curl',
    'lateral raise': 'Dumbbell Lateral Raise',
  };
  const lower = message.toLowerCase();
  for (const [keyword, exercise] of Object.entries(keywords)) {
    if (lower.includes(keyword)) return exercise;
  }
  return null;
}

async function sendMessage(to, message) {
  try {
    await twilioClient.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${to}`
    });
    console.log(`✅ Message sent`);
  } catch (error) {
    console.error('Twilio error:', error);
  }
}

async function sendMorningRoutine() {
  const routine = getTodayRoutine();
  let msg = `${routine.day} - ${routine.name}\n\n`;
  routine.exercises.forEach((ex, i) => {
    msg += `${i + 1}. ${ex.name}\n   ${ex.target}\n`;
  });
  msg += `\n💪 Ready?`;
  
  // Dividir en 2 mensajes si es muy largo
  if (msg.length > 1000) {
    const mid = msg.lastIndexOf('\n', msg.length / 2);
    await sendMessage(CONFIG.JULIAN_PHONE, msg.substring(0, mid));
    await new Promise(r => setTimeout(r, 500));
    await sendMessage(CONFIG.JULIAN_PHONE, msg.substring(mid));
  } else {
    await sendMessage(CONFIG.JULIAN_PHONE, msg);
  }
}

cron.schedule('0 8 * * *', sendMorningRoutine, {
  timezone: 'America/Bogota'
});

console.log('✅ Bot scheduled for 8:00 AM');

app.post('/webhook', async (req, res) => {
  const msg = req.body.Body?.trim() || '';
  const from = req.body.From?.replace('whatsapp:', '') || '';

  if (!from.includes('3214709668')) {
    res.sendStatus(403);
    return;
  }

  let response = '';
  const exercise = extractExerciseFromMessage(msg);
  const logs = msg.match(/\d+x\d+(?:,\d+x\d+)*/)?.[0];

  if (exercise && logs) {
    response = `✅ ${exercise}\n📊 ${logs}\n💪 Great job! 🔥`;
  } else if (msg.toLowerCase().includes('today')) {
    const routine = getTodayRoutine();
    response = `${routine.day} - ${routine.name}\n\n`;
    routine.exercises.forEach((ex, i) => {
      response += `${i + 1}. ${ex.name}\n`;
    });
  } else {
    response = `💪 Log: "Bench 95x8,95x8"\nCommand: "today"`;
  }

  await sendMessage(CONFIG.JULIAN_PHONE, response);
  res.sendStatus(200);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', bot: 'GymTrack' });
});

app.get('/', (req, res) => {
  res.json({ status: 'running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🏋️ Bot running on ${PORT}`));

module.exports = app;