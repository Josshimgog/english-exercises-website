// models/Submission.js
const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    exercise: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exercise',
        required: true
    },
    sessionId: { // To link to a specific user session
        type: String,
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    userAnswers: [
        {
            type: String
        }
    ],
    score: {
        type: Number,
        default: 0
    },
    totalQuestions: {
        type: Number,
        default: 0
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    completed: { // Whether the user finished the exercise or timed out/left
        type: Boolean,
        default: false
    },
    leftPage: { // If the user left the page during the exercise
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('Submission', submissionSchema);