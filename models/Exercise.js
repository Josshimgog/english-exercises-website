// models/Exercise.js
const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    questions: [
        {
            type: String,
            required: true
        }
    ],
    answers: [
        {
            type: String,
            required: true
        }
    ],
    type: { // e.g., 'fill-in-the-blank', 'multiple-choice', 'true-false'
        type: String,
        default: 'fill-in-the-blank' // Default type
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Exercise', exerciseSchema);