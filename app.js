// app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const Exercise = require('./models/Exercise');
const Submission = require('./models/Submission');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 25 } // 25 minutes (20 min for exercise + 5 min buffer)
}));

const activeExerciseTimers = {};

const sendDiscordWebhook = async (data) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.warn("Discord Webhook URL not set in .env. Skipping webhook.");
        return;
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            console.error(`Error sending Discord webhook: ${response.status} - ${response.statusText}`);
        } else {
            console.log('Discord webhook sent successfully!');
        }
    } catch (error) {
        console.error('Failed to send Discord webhook:', error);
    }
};

// --- Seed Exercises (Example Data) ---
const seedExercises = async () => {
    const existingExercises = await Exercise.countDocuments();
    if (existingExercises === 0) {
        console.log('No exercises found. Seeding example exercises...');
        const exercises = [
            {
                title: 'Монгол хэлний нэр үгийн дасгал',
                slug: 'mongolian-noun-exercise',
                description: 'Нэр үгийн зөв хэрэглээг олоорой.',
                questions: [
                    'Над __________ ном бий.',
                    'Тэр __________ ирсэн.'
                ],
                answers: [
                    'ном',
                    'сургуулиас'
                ],
                type: 'fill-in-the-blank',
                subject: 'Монгол хэл' // Added subject
            },
            {
                title: 'Англи хэлний үйл үгийн дасгал',
                slug: 'english-verb-exercise',
                description: 'Өгүүлбэрт тохирох үйл үгийг нөхөж бичээрэй.',
                questions: [
                    'She __________ to the store every day.',
                    'They __________ playing football now.'
                ],
                answers: [
                    'goes',
                    'are'
                ],
                type: 'fill-in-the-blank',
                subject: 'Англи хэл' // Added subject
            },
            {
                title: 'Монгол хэлний цагийн дасгал',
                slug: 'mongolian-tense-exercise',
                description: 'Өгөгдсөн үгсийг зөв цагт хувиргаарай.',
                questions: [
                    'Би ____ (ирэх) өнөөдөр.',
                    'Тэд ____ (явах) маргааш.'
                ],
                answers: [
                    'ирсэн',
                    'явна'
                ],
                type: 'fill-in-the-blank',
                subject: 'Монгол хэл' // Added subject
            },
            {
                title: 'Физикийн дасгал: Хүч',
                slug: 'physics-force-exercise',
                description: 'Хүчний тухай мэдлэгээ шалгаарай.',
                questions: [
                    'Энергийн нэгж нь __________ юм.',
                    'Хүчний нэгж нь __________ юм.'
                ],
                answers: [
                    'жоуль',
                    'ньютон'
                ],
                type: 'fill-in-the-blank',
                subject: 'Физик' // Added subject
            },
            {
                title: 'Математикийн дасгал: Үржүүлэх',
                slug: 'math-multiplication-exercise',
                description: 'Үржүүлэх үйлдлийг гүйцэтгээрэй.',
                questions: [
                    '5 * 7 = ?',
                    '12 * 3 = ?'
                ],
                answers: [
                    '35',
                    '36'
                ],
                type: 'fill-in-the-blank',
                subject: 'Математик' // Added subject
            }
        ];
        await Exercise.insertMany(exercises);
        console.log('Example exercises seeded!');
    }
};

seedExercises();

// --- Routes (No changes here, assuming the slug is still the primary way to identify) ---

app.get('/', async (req, res) => {
    try {
        const exercises = await Exercise.find({});
        res.render('index', { exercises });
    } catch (error) {
        console.error('Error fetching exercises:', error);
        res.status(500).send('Өгөгдөл татахад алдаа гарлаа.');
    }
});

app.post('/start-exercise', (req, res) => {
    const { userName, exerciseSlug } = req.body;
    if (!userName || !exerciseSlug) {
        return res.status(400).send('Хэрэглэгчийн нэр эсвэл дасгалын хаяг дутуу байна.');
    }

    req.session.userName = userName;
    req.session.exerciseSlug = exerciseSlug;
    req.session.startTime = Date.now();
    req.session.leftPage = false;
    req.session.isCompleted = false;

    req.session.exerciseSessionId = `${exerciseSlug}_${req.session.id}_${Date.now()}`;

    if (activeExerciseTimers[req.session.exerciseSessionId]) {
        clearTimeout(activeExerciseTimers[req.session.exerciseSessionId]);
        delete activeExerciseTimers[req.session.exerciseSessionId];
    }

    const exerciseDuration = 20 * 60 * 1000;
    const timerId = setTimeout(async () => {
        console.log(`Exercise for session ${req.session.exerciseSessionId} timed out.`);
        if (!req.session.isCompleted) {
            await handleExerciseCompletion(req, res, true);
        }
    }, exerciseDuration);

    activeExerciseTimers[req.session.exerciseSessionId] = timerId;

    res.redirect(`/exercise/${exerciseSlug}/${req.session.exerciseSessionId}`);
});

app.get('/exercise/:slug/:sessionId', async (req, res) => {
    const { slug, sessionId } = req.params;

    if (!req.session.userName || req.session.exerciseSlug !== slug || req.session.exerciseSessionId !== sessionId) {
        return res.redirect('/');
    }

    try {
        const exercise = await Exercise.findOne({ slug });
        if (!exercise) {
            return res.status(404).send('Дасгал олдсонгүй.');
        }

        const existingSubmission = await Submission.findOne({
            exercise: exercise._id,
            sessionId: sessionId,
            userName: req.session.userName
        });

        if (existingSubmission && existingSubmission.completed) {
            return res.render('exercise', {
                exercise,
                userName: req.session.userName,
                sessionId: sessionId,
                showResults: true,
                userAnswers: existingSubmission.userAnswers,
                score: existingSubmission.score,
                totalQuestions: existingSubmission.totalQuestions,
                timedOut: existingSubmission.leftPage // If it's timed out because they left
            });
        }

        res.render('exercise', {
            exercise,
            userName: req.session.userName,
            sessionId: sessionId,
            showResults: false,
            userAnswers: [],
            score: 0,
            totalQuestions: 0,
            timedOut: false
        });

    } catch (error) {
        console.error('Error fetching exercise:', error);
        res.status(500).send('Дасгал татахад алдаа гарлаа.');
    }
});

app.post('/submit-exercise/:slug/:sessionId', async (req, res) => {
    const { slug, sessionId } = req.params;
    const userAnswers = req.body.answers;

    if (!req.session.userName || req.session.exerciseSlug !== slug || req.session.exerciseSessionId !== sessionId) {
        return res.status(403).send('Хүсэлт хүчингүй байна. Дасгалыг дахин эхлүүлнэ үү.');
    }

    req.session.isCompleted = true;

    if (activeExerciseTimers[req.session.exerciseSessionId]) {
        clearTimeout(activeExerciseTimers[req.session.exerciseSessionId]);
        delete activeExerciseTimers[req.session.exerciseSessionId];
    }

    await handleExerciseCompletion(req, res, false, userAnswers);
});

app.post('/activity-monitor/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { type } = req.body;

    if (type === 'blur' && req.session.exerciseSessionId === sessionId && !req.session.isCompleted) {
        req.session.leftPage = true;
        console.log(`User ${req.session.userName} with session ${sessionId} left the tab.`);
        await handleExerciseCompletion(req, res, true, [], true);
    } else if (type === 'focus' && req.session.exerciseSessionId === sessionId) {
        console.log(`User ${req.session.userName} with session ${sessionId} returned to the tab.`);
        // Note: If they left and were already marked 0, this focus event won't change that.
    }

    res.status(200).send('OK');
});

async function handleExerciseCompletion(req, res, timedOut, userAnswers = [], leftPageDetected = false) {
    const { slug, sessionId, userName } = req.session;

    try {
        const exercise = await Exercise.findOne({ slug });
        if (!exercise) {
            console.error('Exercise not found during completion handling:', slug);
            return res.status(404).send('Дасгал олдсонгүй.');
        }

        let score = 0;
        const totalQuestions = exercise.answers.length;
        const correctAnswers = exercise.answers.map(ans => ans.toLowerCase().trim());

        if (!timedOut && userAnswers && userAnswers.length > 0) {
            for (let i = 0; i < totalQuestions; i++) {
                const userAnswer = userAnswers[i] ? userAnswers[i].toLowerCase().trim() : '';
                if (userAnswer === correctAnswers[i]) {
                    score++;
                }
            }
        } else if (timedOut || leftPageDetected) {
            score = 0;
            userAnswers = Array(totalQuestions).fill(''); // Ensure userAnswers is an array matching questions length for display
        }

        let submission = await Submission.findOne({
            exercise: exercise._id,
            sessionId: sessionId,
            userName: userName
        });

        if (submission) {
            submission.userAnswers = userAnswers;
            submission.score = score;
            submission.totalQuestions = totalQuestions;
            submission.completed = true;
            submission.leftPage = leftPageDetected;
            await submission.save();
        } else {
            submission = new Submission({
                exercise: exercise._id,
                sessionId: sessionId,
                userName: userName,
                userAnswers: userAnswers,
                score: score,
                totalQuestions: totalQuestions,
                completed: true,
                leftPage: leftPageDetected
            });
            await submission.save();
        }

        const webhookMessage = {
            username: "Exercise Bot",
            avatar_url: "https://imgur.com/a/zxS6VAD",
            embeds: [
                {
                    title: `Дасгал дууссан: ${exercise.title}`,
                    description: `**Нэр:** ${userName}\n**Дасгалын нэр:** ${exercise.title}\n**Оноо:** ${score} / ${totalQuestions}`,
                    color: leftPageDetected ? 16711680 : (score === totalQuestions ? 65280 : 16776960),
                    fields: [
                        {
                            name: "Төлөв",
                            value: leftPageDetected ? "Хуудаснаас гарсан (0 оноо)" : (timedOut ? "Хугацаа дууссан (0 оноо)" : "Дууссан"),
                            inline: true
                        },
                        {
                            name: "Дуусгасан хугацаа",
                            value: new Date().toLocaleString('mn-MN'),
                            inline: true
                        }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: {
                        text: "English Exercise Website"
                    }
                }
            ]
        };

        sendDiscordWebhook(webhookMessage);

        res.render('exercise', {
            exercise,
            userName: userName,
            sessionId: sessionId,
            showResults: true,
            userAnswers: submission.userAnswers,
            score: submission.score,
            totalQuestions: submission.totalQuestions,
            timedOut: timedOut || leftPageDetected,
            correctAnswers: exercise.answers
        });

        delete req.session.exerciseSlug;
        delete req.session.startTime;
        delete req.session.exerciseSessionId;
        delete req.session.isCompleted;
        delete req.session.leftPage;


    } catch (error) {
        console.error('Error handling exercise completion:', error);
        res.status(500).send('Дасгал дуусгахад алдаа гарлаа.');
    }
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});