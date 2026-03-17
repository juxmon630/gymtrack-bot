// gymtrack_bot_production.js
// Production-ready WhatsApp bot for Julian Perez
// Deploy to Railway: railway up

const express = require('express');
const twilio = require('twilio');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

// ============ CONFIGURATION ============

const CONFIG = {
  JULIAN_PHONE: '+573214709668',
  JULIAN_EMAIL: 'Jul630@gmail.com',
  TIMEZONE: 'America/Bogota',
  MORNING_ALERT_TIME: '08:00', // 8 AM GMT-5
  WEEKLY_REPORT_DAY: 3, // Wednesday
  WEEKLY_REPORT_TIME: '18:00', // 6 PM GMT-5
};

// ============ INITIALIZE TWILIO ============

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ============ INITIALIZE FIREBASE ============

let db;

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  });
  db = admin.database();
  console.log('✅ Firebase initialized');
} catch (error) {
  console.error('Firebase initialization failed:', error);
  process.exit(1);
}

// ============ ROUTINES DATABASE ============

const ROUTINES = {
  0: {
    day: 'SUNDAY',
    name: '🦵 HEAVY LEG DAY',
    emoji: '🏋️',
    exercises: [
      { name: 'Smith Machine Squat', target: '4×8 @ 135 lbs' },
      { name: 'Barbell Romanian Deadlift', target: '4×8 @ 115 lbs' },
      { name: 'Machine Leg Press (Wide Stance)', target: '4×10 @ 180 lbs' },
      { name: 'Barbell Hip Thrust', target: '4×8 @ 135 lbs' }
    ]
  },
  1: {
    day: 'MONDAY',
    name: '🔵 BACK & TRICEPS',
    emoji: '⬅️',
    exercises: [
      { name: 'Cable Front Lat Pulldown (Close Grip)', target: '4×10 @ 100 lbs' },
      { name: 'T Bar Row', target: '4×8 @ 155 lbs' },
      { name: 'Cable Rope Face Pull', target: '3×15 @ 60 lbs' },
      { name: 'Cable Tricep Pushdown (Rope)', target: '4×10 @ 30 lbs' },
      { name: 'Machine Seated Tricep Dip', target: '4×12 @ 100 lbs' }
    ]
  },
  2: {
    day: 'TUESDAY',
    name: '🟡 CHEST & BICEPS',
    emoji: '💪',
    exercises: [
      { name: 'Barbell Bench Press', target: '4×8 @ 105 lbs' },
      { name: 'Dumbbell Incline Bench Press', target: '4×8 @ 40 lbs' },
      { name: 'Machine Fly', target: '4×10 @ 100 lbs' },
      { name: 'Dumbbell Alternating Bicep Curl', target: '3×12 @ 15 lbs' },
      { name: 'Preacher Curl Machine', target: '3×12 @ 35 lbs' }
    ]
  },
  3: {
    day: 'WEDNESDAY',
    name: '🏊 SWIMMING',
    emoji: '🏊',
    exercises: [
      { name: 'Swimming - 30-45 min', target: 'Cardio day' }
    ]
  },
  4: {
    day: 'THURSDAY',
    name: '🦵 LIGHT LOWER',
    emoji: '🏋️',
    exercises: [
      { name: 'Smith Machine Squat', target: '3×8 @ 125 lbs' },
      { name: 'Barbell Romanian Deadlift', target: '3×8 @ 105 lbs' },
      { name: 'Machine Leg Press (Wide Stance)', target: '3×10 @ 170 lbs' }
    ]
  },
  5: {
    day: 'FRIDAY',
    name: '🟡 LIGHT UPPER',
    emoji: '💪',
    exercises: [
      { name: 'Barbell Bench Press', target: '3×8 @ 95 lbs' },
      { name: 'Cable Front Lat Pulldown (Close Grip)', target: '4×10 @ 100 lbs' },
      { name: 'Dumbbell Lateral Raise', target: '3×12 @ 15 lbs' },
      { name: 'Dumbbell Alternating Bicep Curl', target: '3×12 @ 15 lbs' }
    ]
  },
  6: {
    day: 'SATURDAY',
    name: '🏊 SWIMMING',
    emoji: '🏊',
    exercises: [
      { name: 'Swimming - 30-45 min', target: 'Cardio day' }
    ]
  }
};

const MUSCLE_GROUPS = {
  // Legs
  'Smith Machine Squat': 'Legs',
  'Barbell Squat': 'Legs',
  'Machine Leg Press (Wide Stance)': 'Legs',
  'Leg Curl': 'Legs',
  'Leg Extension': 'Legs',
  'Barbell Romanian Deadlift': 'Legs',
  
  // Glutes
  'Barbell Hip Thrust': 'Glutes',
  
  // Back
  'Cable Front Lat Pulldown (Close Grip)': 'Back',
  'T Bar Row': 'Back',
  'Barbell Rows': 'Back',
  'Lat Pulldown': 'Back',
  
  // Shoulders
  'Cable Rope Face Pull': 'Shoulders',
  'Dumbbell Lateral Raise': 'Shoulders',
  'Dumbbell Shoulder Press': 'Shoulders',
  'Machine Shoulder Press': 'Shoulders',
  
  // Chest
  'Barbell Bench Press': 'Chest',
  'Dumbbell Incline Bench Press': 'Chest',
  'Barbell Incline Bench Press': 'Chest',
  'Machine Fly': 'Chest',
  'Cable Chest Fly': 'Chest',
  
  // Triceps
  'Cable Tricep Pushdown (Rope)': 'Triceps',
  'Machine Seated Tricep Dip': 'Triceps',
  'Tricep Dips': 'Triceps',
  
  // Biceps
  'Dumbbell Alternating Bicep Curl': 'Biceps',
  'Preacher Curl Machine': 'Biceps',
  'Barbell Curl': 'Biceps',
  
  // Core/Abs
  'Ab Crunch': 'Core',
  'Cable Crunch': 'Core',
  'Ab Wheel': 'Core',
  'Decline Sit-ups': 'Core',
  'Planks': 'Core',
  
  // Cardio
  'Swimming - 30-45 min': 'Cardio',
  'Swimming': 'Cardio',
  'Walking': 'Cardio',
  'Running': 'Cardio',
  'Elliptical': 'Cardio'
};

// ============ HELPER FUNCTIONS ============

function getTodayRoutine() {
  const today = new Date().getDay();
  return ROUTINES[today];
}

function parseWorkoutLogs(logsString) {
  return logsString.split(',').map(set => {
    const match = set.trim().match(/(\d+(?:\.\d+)?)\s*x\s*(\d+)/);
    if (match) {
      return { weight: parseFloat(match[1]), reps: parseInt(match[2]) };
    }
    return null;
  }).filter(Boolean);
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
    'fly': 'Machine Fly',
    't bar': 'T Bar Row',
    'hip thrust': 'Barbell Hip Thrust',
    'rowing': 'T Bar Row',
    'preacher': 'Preacher Curl Machine',
    'dips': 'Machine Seated Tricep Dip'
  };

  const lowerMessage = message.toLowerCase();
  for (const [keyword, exercise] of Object.entries(keywords)) {
    if (lowerMessage.includes(keyword)) {
      return exercise;
    }
  }
  return null;
}

async function getLastSession(exercise) {
  try {
    const snapshot = await db
      .ref(`users/${CONFIG.JULIAN_PHONE}/workouts`)
      .orderByChild('exercise')
      .equalTo(exercise)
      .limitToLast(1)
      .once('value');

    if (snapshot.exists()) {
      const workouts = Object.values(snapshot.val());
      return workouts[0];
    }
    return null;
  } catch (error) {
    console.error('Firebase query error:', error);
    return null;
  }
}

function generateAlert(exercise, logs, lastSession) {
  const sets = parseWorkoutLogs(logs);
  const alerts = [];

  if (lastSession) {
    const lastLogs = parseWorkoutLogs(lastSession.logs);
    const lastWeight = Math.max(...lastLogs.map(s => s.weight));
    const currentWeight = Math.max(...sets.map(s => s.weight));

    if (currentWeight > lastWeight) {
      const increase = currentWeight - lastWeight;
      alerts.push(`🎯 PROGRESS! +${increase} lbs! Next time try +5 lbs more.`);
    } else if (currentWeight < lastWeight) {
      const decrease = lastWeight - currentWeight;
      alerts.push(`⚠️ Weight down ${decrease} lbs. Everything OK?`);
    }
  }

  if (sets.length > 1) {
    for (let i = 1; i < sets.length; i++) {
      const repDrop = sets[i - 1].reps - sets[i].reps;
      if (repDrop > 2) {
        alerts.push(`⏰ Reps dropped set ${i + 1}. Rest 5 min longer.`);
      }
    }
  }

  return alerts;
}

async function saveWorkout(exercise, logs, difficulty, notes) {
  try {
    await db.ref(`users/${CONFIG.JULIAN_PHONE}/workouts`).push({
      exercise,
      logs,
      difficulty,
      notes,
      muscleGroup: MUSCLE_GROUPS[exercise] || 'Other',
      timestamp: admin.database.ServerValue.TIMESTAMP,
      date: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Save error:', error);
    return false;
  }
}

async function sendMessage(to, message) {
  try {
    await twilioClient.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${to}`
    });
    console.log(`✅ Message sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Twilio error:', error);
    return false;
  }
}

// ============ SCHEDULED MESSAGES ============

async function sendMorningRoutine() {
  const routine = getTodayRoutine();
  let message = `${routine.emoji} ${routine.day} - ${routine.name}\n\n`;
  message += `Today's exercises:\n`;

  routine.exercises.forEach((ex, i) => {
    message += `${i + 1}. ${ex.name}\n   ${ex.target}\n`;
  });

  message += `\n💪 Ready? Log your progress as you go!`;

  await sendMessage(CONFIG.JULIAN_PHONE, message);
}

// ============ CRON JOBS ============

// Send morning routine at 8:00 AM every day (GMT-5)
cron.schedule('0 8 * * *', () => {
  console.log(`[${new Date().toISOString()}] Sending morning routine...`);
  sendMorningRoutine();
}, {
  timezone: 'America/Bogota'
});

console.log('✅ Morning routine scheduled for 8:00 AM GMT-5');

// ============ WEBHOOK ENDPOINT ============

app.post('/webhook', async (req, res) => {
  const incomingMessage = req.body.Body ? req.body.Body.trim() : '';
  const from = req.body.From ? req.body.From.replace('whatsapp:', '') : '';

  console.log(`[${new Date().toISOString()}] Message from ${from}: ${incomingMessage}`);

  // Only process from Julian
  if (!from.includes('3214709668')) {
    console.log('⛔ Rejected - not authorized user');
    res.sendStatus(403);
    return;
  }

  let response = '';

  // Parse workout log
  const exerciseName = extractExerciseFromMessage(incomingMessage);
  const logsMatch = incomingMessage.match(/\d+(?:\.\d+)?x\d+(?:,\d+(?:\.\d+)?x\d+)*/);
  const logs = logsMatch ? logsMatch[0] : null;

  if (exerciseName && logs) {
    // Valid workout log
    const lastSession = await getLastSession(exerciseName);
    const alerts = generateAlert(exerciseName, logs, lastSession);
    const difficultyMatch = incomingMessage.match(/\b([1-9]|10)\b/);
    const difficulty = difficultyMatch ? parseInt(difficultyMatch[0]) : 5;

    await saveWorkout(exerciseName, logs, difficulty, incomingMessage);

    response = `✅ ${exerciseName}\n`;
    response += `📊 ${logs}\n`;
    response += `💪 Difficulty: ${difficulty}/10\n\n`;

    if (alerts.length > 0) {
      response += alerts.join('\n\n') + '\n\n';
    }

    response += `Keep crushing it! 🔥`;
  } else if (incomingMessage.toLowerCase().includes('today')) {
    const routine = getTodayRoutine();
    response = `${routine.emoji} ${routine.day} - ${routine.name}\n\n`;
    routine.exercises.forEach((ex, i) => {
      response += `${i + 1}. ${ex.name} (${ex.target})\n`;
    });
  } else if (incomingMessage.toLowerCase().includes('help')) {
    response = `💪 GymTrack Bot\n\nLog workouts:\n"Bench 95x8,95x8,105x8"\n\nCommands:\n• "today" - Today's routine\n• "help" - This message`;
  } else {
    response = `💪 GymTrack Bot\n\nSend workout like:\n"Bench 95x8,95x8,105x8"\n\nReply "help" for commands`;
  }

  await sendMessage(CONFIG.JULIAN_PHONE, response);
  res.sendStatus(200);
});

// ============ HEALTH CHECK ============

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), user: 'Julian Perez' });
});

app.get('/', (req, res) => {
  res.json({ 
    app: 'GymTrack Bot',
    status: 'running',
    version: '1.0',
    user: 'Julian Perez',
    phone: CONFIG.JULIAN_PHONE,
    timezone: CONFIG.TIMEZONE,
    morningAlert: CONFIG.MORNING_ALERT_TIME + ' GMT-5'
  });
});

// ============ ERROR HANDLING ============

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║    🏋️ GymTrack Bot - PRODUCTION       ║
  ║    Ready to track Julian's workouts   ║
  ╚════════════════════════════════════════╝
  
  ✅ Server running on port ${PORT}
  ✅ Morning alerts: 8:00 AM GMT-5
  ✅ WhatsApp webhook: /webhook
  ✅ Health check: /health
  
  User: Julián Pérez
  Phone: +57 321 470 9668
  Email: Jul630@gmail.com
  `);
});

module.exports = app;
