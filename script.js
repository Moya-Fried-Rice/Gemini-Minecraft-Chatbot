import {model} from "./mainmodule.js";
let x = 0;
let y = 0;
let targetX = 0;
let targetY = 0;
let time = 0; // A time variable to create periodic motion
const layers = document.querySelectorAll('#parallax-container img, #parallax-container #steve');

// --- Detect touch device ---
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// --- Mouse-based parallax (desktop) ---
document.addEventListener('mousemove', function(e) {
    targetX = e.clientX / window.innerWidth;
    targetY = e.clientY / window.innerHeight;
});

// --- Touch/drag-based parallax (mobile) ---
let touchStartX = 0;
let touchStartY = 0;
let touchBaseX = 0.5; // Start centered
let touchBaseY = 0.5;
let orientationEnabled = false;
let orientationRequested = false;
let orientationBaseBeta = null;
let orientationBaseGamma = null;
const touchParallaxSensitivity = 8;
const tiltParallaxSensitivity = 25;

function handleDeviceOrientation(event) {
    if (event.beta === null || event.gamma === null) return;

    if (orientationBaseBeta === null || orientationBaseGamma === null) {
        orientationBaseBeta = event.beta;
        orientationBaseGamma = event.gamma;
    }

    const tiltX = (event.gamma - orientationBaseGamma) / tiltParallaxSensitivity;
    const tiltY = (event.beta - orientationBaseBeta) / tiltParallaxSensitivity;
    targetX = Math.max(0, Math.min(1, 0.5 + tiltX));
    targetY = Math.max(0, Math.min(1, 0.5 + tiltY));
    orientationEnabled = true;
}

function requestDeviceOrientation() {
    if (orientationRequested || !window.DeviceOrientationEvent) return;
    orientationRequested = true;

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission()
            .then(permission => {
                if (permission === "granted") {
                    window.addEventListener("deviceorientation", handleDeviceOrientation);
                }
            })
            .catch(() => {
                orientationRequested = false;
            });
    } else {
        window.addEventListener("deviceorientation", handleDeviceOrientation);
    }
}

if (isTouchDevice) {
    // Initialize targets to center so it looks natural before first touch
    targetX = 0.5;
    targetY = 0.5;

    const parallaxContainer = document.getElementById('parallax-container');

    parallaxContainer.addEventListener('touchstart', function(e) {
        // Don't interfere with taps on the chat UI
        if (e.target.closest('#steve')) return;

        requestDeviceOrientation();
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchBaseX = targetX;
        touchBaseY = targetY;
    }, { passive: true });

    parallaxContainer.addEventListener('touchmove', function(e) {
        // Don't interfere with scrolling inside the chat
        if (e.target.closest('#steve') || orientationEnabled) return;

        const touch = e.touches[0];
        const deltaX = (touch.clientX - touchStartX) / window.innerWidth;
        const deltaY = (touch.clientY - touchStartY) / window.innerHeight;

        targetX = Math.max(0, Math.min(1, touchBaseX + deltaX * touchParallaxSensitivity));
        targetY = Math.max(0, Math.min(1, touchBaseY + deltaY * touchParallaxSensitivity));
    }, { passive: true });
}

// This function will animate the movement
function animate() {
    // Add a subtle continuous motion to targetX and targetY
    time += 0.01; // Increment time for smooth motion
    const noiseX = Math.sin(time) * 0.25; // Small periodic motion for X
    const noiseY = Math.cos(time) * 0.25; // Small periodic motion for Y
    
    // Combine mouse movement with continuous motion
    const finalTargetX = targetX + noiseX;
    const finalTargetY = targetY + noiseY;

    // Smoothly transition to the new target position
    x += (finalTargetX - x) * 0.1; // Interpolation factor (controls speed)
    y += (finalTargetY - y) * 0.1;

    // Apply the parallax effect
    layers.forEach((layer, index) => {
        const movement = (index + 1) * 10; // Control speed based on layer
        const offsetX = x * movement * 0.05;
        const offsetY = (y - 1) * movement * 0.05;

        layer.style.setProperty("--parallax-x", `${offsetX}vw`);
        layer.style.setProperty("--parallax-y", `${offsetY}vw`);
    });

    // Request the next frame to keep animating
    requestAnimationFrame(animate);
}

// Start the animation loop
animate();

const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chatbot-container");
const chatBox = document.querySelector(".chat");
const sampleQuestions = document.querySelector('.sample-questions');
const audio = document.getElementById('audioPlayer');
const steveButton = document.querySelector("#steve-button");
const stoneClicked = new Audio("sounds/Stone_button_press.ogg");
const stoneUnclicked = new Audio("sounds/Stone_button_unpress.ogg");
let steveLightTimeout = null;

let conversationHistory = [];
let isGenerating = false;
let abortController = null;
let stopRequested = false;
let currentTypingInterval = null;
let currentPauseTimeout = null;
let currentResolve = null;

function changeSteveLight() {
    steveButton.src = "images/steve-on.png";

    if (steveLightTimeout) {
        clearTimeout(steveLightTimeout);
    }

    steveLightTimeout = setTimeout(() => {
        steveButton.src = "images/steve-off.png";
        stoneUnclicked.play();
        steveLightTimeout = null;
    }, 1500);
}

function updateSendButtonState() {
    sendButton.disabled = !isGenerating && !chatInput.value.trim();
}

function setGenerating(generating) {
    isGenerating = generating;
    if (generating) {
        sendButton.textContent = "Stop";
        sendButton.disabled = false;
        chatInput.disabled = true;
        chatInput.placeholder = 'Steve is... "thinking"';
    } else {
        sendButton.textContent = "Send";
        chatInput.disabled = false;
        chatInput.placeholder = "Type your message...";
        chatInput.focus();
        updateSendButtonState();
    }
}

function stopGeneration() {
    stopRequested = true;
    if (abortController) {
        try {
            abortController.abort();
        } catch (_) {}
    }
    if (currentTypingInterval) {
        clearInterval(currentTypingInterval);
        currentTypingInterval = null;
    }
    if (currentPauseTimeout) {
        clearTimeout(currentPauseTimeout);
        currentPauseTimeout = null;
    }
    if (currentResolve) {
        currentResolve();
        currentResolve = null;
    }
    setGenerating(false);
}

const getChatResponse = async () => {
    const message = chatInput.value;
    console.log("User:", message);

    // Add the user's message to the conversation history
    conversationHistory.push({
        role: "user",
        parts: [{ text: message }]
    });

    const pEle = document.createElement("div");

    sampleQuestions.style.display = 'none';
    audio.muted = false;
    audio.play();
    stoneClicked.play();
    changeSteveLight();

    stopRequested = false;
    abortController = new AbortController();
    setGenerating(true);

    try {
        // Pass the conversation history to the model with abort signal
        const result = await model.generateContent({
            contents: conversationHistory,
            signal: abortController.signal
        });
        const response = await result.response.text();

        if (stopRequested) {
            return;
        }

        // Add the AI's response to the conversation history
        conversationHistory.push({
            role: "model",
            parts: [{ text: response }]
        });

        chatInput.placeholder = 'Steve is typing...';

        function splitParagraph(paragraph) {
            let parentheticalSentences = [];
            paragraph = paragraph.replace(/\(([^)]+)\)/g, (match, p1) => {
                let sentences = p1.match(/[^.!?]+(?:\.\.\.|[.!?])+/g) || [p1];
                sentences.forEach(sentence => parentheticalSentences.push(`**${sentence.trim()}`));
                return ''; 
            });
        
            let sentences = paragraph.match(/[^.!?]+(?:\.\.\.|[.!?])+/g) || [paragraph];
            let result = [];
        
            if (sentences.length > 0) {
                result.push(sentences.shift().trim());
            }
        
            while (sentences.length > 0) {
                let chunkSize = Math.min(sentences.length, Math.floor(Math.random() * 3) + 1);
                result.push(sentences.splice(0, chunkSize).join(' ').trim());
            }
        
            result = parentheticalSentences.concat(result);
            return result.filter(sentence => sentence.length > 0);
        }

        const sentences = splitParagraph(response);

        function typeSentence(subSentence, paragraph) {
            return new Promise(resolve => {
                currentResolve = resolve;
                let charIndex = 0;
                const isSpecial = subSentence.startsWith("**");
                if (isSpecial) {
                    subSentence = subSentence.substring(2).trim();
                }

                const span = document.createElement('span');
                if (isSpecial) {
                    span.style.opacity = "0.7";
                }
                span.textContent = "";  
                paragraph.appendChild(span);  

                currentTypingInterval = setInterval(() => {
                    if (stopRequested) {
                        clearInterval(currentTypingInterval);
                        currentTypingInterval = null;
                        currentResolve = null;
                        resolve();
                        return;
                    }
                    span.textContent += subSentence[charIndex];
                    charIndex++;
                    if (charIndex === subSentence.length) {
                        clearInterval(currentTypingInterval);
                        currentTypingInterval = null;
                        currentResolve = null;
                        resolve();
                    }
                    chatBox.scrollTo({
                        top: chatContainer.scrollHeight,
                        behavior: 'smooth'
                    });
                }, 35);
            });
        }

        function pause() {
            if (stopRequested) return Promise.resolve();
            const randomPause = Math.floor(Math.random() * (1000 - 700 + 1)) + 700;
            return new Promise(resolve => {
                currentResolve = resolve;
                currentPauseTimeout = setTimeout(() => {
                    currentPauseTimeout = null;
                    currentResolve = null;
                    resolve();
                }, randomPause);
            });
        }

        async function handleTypingEffect() {
            chatContainer.appendChild(pEle);
            for (let sentence of sentences) {
                if (stopRequested) break;
                const subSentences = sentence.match(/[^.!?]+(?:[.!?]+)?/g) || [sentence];

                const bubble = document.createElement('div');
                bubble.classList.add("chat-body-inner", "w-5/6");

                const paragraph = document.createElement('span');
                paragraph.classList.add('m-2');

                if (!sentence.startsWith("**")) {
                    bubble.innerHTML = `<span class="steve-text">&lt;Steve&gt;</span>`; 
                }

                bubble.appendChild(paragraph);
                pEle.appendChild(bubble);

                for (let subSentence of subSentences) {
                    if (stopRequested) break;
                    await typeSentence(subSentence, paragraph);
                    if (stopRequested) break;
                    await pause();
                }
                console.log("Steve:", sentence);
            }
            
            setGenerating(false);
        }

        handleTypingEffect();
        
    } catch (error) {
        if (error.name === "AbortError" || stopRequested) {
            console.log("Gemini request was stopped.");
            if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === "user") {
                conversationHistory.pop();
            }
        } else {
            pEle.classList.add("gemini-response");
            console.log("Error fetching gemini response: ", error);
            pEle.innerHTML = `
            <div class="chat-body-inner text-left p-5">
                <p>Oops! Something went wrong.</p>
            </div>`;
            chatContainer.appendChild(pEle);
        }
        setGenerating(false);
    }
};

const handleAPI = () => {
    if (isGenerating) return;
    const userText = chatInput.value.trim();
    if (!userText) return;
    chatBox.classList.add("has-messages");
    getChatResponse();
    chatInput.value = '';
    updateSendButtonState();

    const chatBubble = document.createElement("div");
    chatBubble.classList.add("chat-bubble");
    chatBubble.innerHTML = `
    <div class="chat-body-inner text-right p-5 w-5/6 ml-auto">
        <p>${userText}</p>
    </div>
    `;
    chatContainer.appendChild(chatBubble);
    chatBox.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
};

sendButton.addEventListener("click", () => {
    if (isGenerating) {
        stoneClicked.play();
        changeSteveLight();
        stopGeneration();
    } else {
        handleAPI();
    }
});

chatInput.addEventListener("input", updateSendButtonState);

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isGenerating) {
            handleAPI();
        }
    }
});

const questionElements = document.querySelectorAll('.question');
questionElements.forEach(question => {
    question.addEventListener('click', (event) => {
        if (isGenerating) return;
        const questionText = event.target.textContent;
        chatInput.value = questionText;
        handleAPI();
    });
});

updateSendButtonState();
