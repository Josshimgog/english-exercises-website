// public/js/script.js

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the homepage
    if (document.getElementById('nameForm')) {
        handleHomepage();
    }
    // Check if we are on the exercise page
    if (document.getElementById('exerciseForm')) {
        handleExercisePage();
    }

    // Universal button ripple effect
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function(e) {
            const circle = document.createElement('span');
            const diameter = Math.max(this.clientWidth, this.clientHeight);
            const radius = diameter / 2;

            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${e.clientX - (this.getBoundingClientRect().left + radius)}px`;
            circle.style.top = `${e.clientY - (this.getBoundingClientRect().top + radius)}px`;
            circle.classList.add('ripple');

            const ripple = this.getElementsByClassName('ripple')[0];

            if (ripple) {
                ripple.remove();
            }

            this.appendChild(circle);
        });
    });
});


function handleHomepage() {
    const userNameInput = document.getElementById('userName');
    const enableExercisesButton = document.getElementById('enableExercisesButton');
    const exercisesTitle = document.getElementById('exercisesTitle');
    const exerciseList = document.getElementById('exerciseList');
    const exerciseCards = document.querySelectorAll('.exercise-card');
    const nameForm = document.getElementById('nameForm');

    enableExercisesButton.addEventListener('click', () => {
        const userName = userNameInput.value.trim();
        if (!userName) {
            alert('Дасгалыг эхлүүлэхийн тулд нэрээ оруулна уу.');
            return;
        }

        // Add class to hide name form and reveal exercise list
        nameForm.classList.add('hidden'); // Hide the form with a class that sets display:none
        exercisesTitle.classList.remove('hidden'); // Show title
        exerciseList.classList.remove('hidden'); // Show list

        // Trigger stagger animation for cards
        setTimeout(() => {
            exerciseList.classList.add('revealed');
        }, 100); // Small delay to ensure hidden class is applied first


        // Store the entered user name in session storage for later use when selecting an exercise
        sessionStorage.setItem('tempUserName', userName);
    });

    exerciseCards.forEach(card => {
        card.addEventListener('click', () => {
            const userName = sessionStorage.getItem('tempUserName');
            if (!userName) {
                alert('Эхлээд нэрээ оруулна уу.');
                return;
            }
            const exerciseSlug = card.dataset.slug;

            // Create a temporary form to submit the name and slug
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/start-exercise';
            form.style.display = 'none'; // Hide the form

            const userNameInput = document.createElement('input');
            userNameInput.type = 'hidden';
            userNameInput.name = 'userName';
            userNameInput.value = userName;
            form.appendChild(userNameInput);

            const exerciseSlugInput = document.createElement('input');
            exerciseSlugInput.type = 'hidden';
            exerciseSlugInput.name = 'exerciseSlug';
            exerciseSlugInput.value = exerciseSlug;
            form.appendChild(exerciseSlugInput);

            document.body.appendChild(form);
            form.submit();
        });
    });
}

function handleExercisePage() {
    const form = document.getElementById('exerciseForm');
    const countdownElement = document.getElementById('countdown');
    const progressBar = document.getElementById('progressBar');
    const questionItems = document.querySelectorAll('.question-item');
    const totalQuestions = parseInt(document.querySelector('.questions-container').dataset.totalQuestions);
    const prevButton = document.getElementById('prevQuestion');
    const nextButton = document.getElementById('nextQuestion');
    const finishButton = document.getElementById('finishButton');

    let currentQuestionIndex = 0;
    let timerInterval;
    const exerciseDurationMinutes = 20; // Matches server-side
    let timeRemaining = exerciseDurationMinutes * 60; // seconds

    // Initialize progress bar
    updateProgressBar();
    showQuestion(currentQuestionIndex, 'initial'); // Show first question

    function updateCountdown() {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        countdownElement.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            if (form) {
                form.submit(); // Auto submit if time runs out
            }
        } else {
            timeRemaining--;
            updateProgressBar();
        }
    }

    function updateProgressBar() {
        // Progress based on questions answered
        const questionsCompleted = Array.from(questionItems).filter(item => {
            const input = item.querySelector('.answer-input');
            return input && input.value.trim() !== '';
        }).length;

        // Optionally, combine with time progress
        // let progressPercentage = (questionsCompleted / totalQuestions) * 100;
        // let timeProgress = ((exerciseDurationMinutes * 60 - timeRemaining) / (exerciseDurationMinutes * 60)) * 100;
        // progressPercentage = Math.max(progressPercentage, timeProgress); // Show max of question or time progress

        // Let's stick to question progress for now for simplicity and clarity of user progress
        const progressPercentage = (currentQuestionIndex / (totalQuestions - 1)) * 100; // Progress based on current question
        progressBar.style.width = `${progressPercentage}%`;
    }

    function showQuestion(index, direction) {
        questionItems.forEach((item, idx) => {
            if (idx === index) {
                item.classList.remove('hidden', 'slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');
                item.classList.add('active');
                if (direction === 'next') {
                    item.classList.add('slide-in-right');
                } else if (direction === 'prev') {
                    item.classList.add('slide-in-left');
                }
                // Focus on the input field of the new question
                item.querySelector('.answer-input').focus();
            } else {
                if (item.classList.contains('active')) {
                    // Animate out the current active question
                    if (direction === 'next') {
                        item.classList.add('slide-out-left');
                    } else if (direction === 'prev') {
                        item.classList.add('slide-out-right');
                    }
                    setTimeout(() => {
                        item.classList.remove('active', 'slide-out-left', 'slide-out-right');
                        item.classList.add('hidden');
                    }, 500); // Match animation duration
                } else {
                     item.classList.add('hidden');
                }
            }
        });

        // Update button visibility
        prevButton.classList.toggle('hidden', index === 0);
        nextButton.classList.toggle('hidden', index === totalQuestions - 1);
        finishButton.classList.toggle('hidden', index !== totalQuestions - 1);

        updateProgressBar();
    }

    prevButton.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            showQuestion(currentQuestionIndex, 'prev');
        }
    });

    nextButton.addEventListener('click', () => {
        if (currentQuestionIndex < totalQuestions - 1) {
            currentQuestionIndex++;
            showQuestion(currentQuestionIndex, 'next');
        }
    });

    // Start the timer only if the form is present (i.e., not showing results)
    if (form) {
        timerInterval = setInterval(updateCountdown, 1000);
    }

    // Activity Monitoring
    function sendActivityStatus(type) {
        const sessionId = form.action.split('/').pop(); // Extract sessionId from form action
        fetch(`/activity-monitor/${sessionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ type: type }),
        }).then(response => {
            if (!response.ok) {
                console.error('Failed to send activity status:', response.statusText);
            }
        }).catch(error => {
            console.error('Error sending activity status:', error);
        });
    }

    window.addEventListener('blur', () => {
        sendActivityStatus('blur');
    });

    window.addEventListener('focus', () => {
        sendActivityStatus('focus');
    });

    window.addEventListener('beforeunload', (event) => {
        if (form) {
            event.preventDefault();
            event.returnValue = 'Та хуудсыг орхивол таны оноо 0 болно!';
        }
    });

    if (form) {
        form.addEventListener('submit', () => {
            clearInterval(timerInterval);
        });
    }
}