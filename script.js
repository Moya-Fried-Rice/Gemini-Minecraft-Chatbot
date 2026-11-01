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
// Ignore mouse movement when cursor is over the chat UI to prevent
// the parallax from displacing the panel while the user interacts with it.
document.addEventListener('mousemove', function(e) {
    if (e.target.closest('#steve')) return;
    targetX = e.clientX / window.innerWidth;
    targetY = e.clientY / window.innerHeight;
});

// --- Touch/drag-based parallax for background (mobile) ---
let parallaxTouchStartX = 0;
let parallaxTouchStartY = 0;
let parallaxTouchBaseX = 0.5;
let parallaxTouchBaseY = 0.5;

if (isTouchDevice) {
    targetX = 0.5;
    targetY = 0.5;

    const parallaxContainer = document.getElementById('parallax-container');

    parallaxContainer.addEventListener('touchstart', function(e) {
        // If touch is on #steve, do nothing — steve's own handlers take over
        if (e.target.closest('#steve')) return;

        const touch = e.touches[0];
        parallaxTouchStartX = touch.clientX;
        parallaxTouchStartY = touch.clientY;
        parallaxTouchBaseX = targetX;
        parallaxTouchBaseY = targetY;
    }, { passive: true });

    parallaxContainer.addEventListener('touchmove', function(e) {
        if (e.target.closest('#steve')) return;

        // Prevent browser from doing anything with background drags
        e.preventDefault();

        const touch = e.touches[0];
        const deltaX = (touch.clientX - parallaxTouchStartX) / window.innerWidth;
        const deltaY = (touch.clientY - parallaxTouchStartY) / window.innerHeight;

        const sensitivity = 2.5;
        targetX = Math.max(0, Math.min(1, parallaxTouchBaseX + deltaX * sensitivity));
        targetY = Math.max(0, Math.min(1, parallaxTouchBaseY + deltaY * sensitivity));
    }, { passive: false }); // non-passive so we can preventDefault
}

// --- Horizontal drag for #steve on small screens (mobile) ---
const steveEl = document.getElementById('steve');
let steveDragStartX = null;
let steveDragStartY = null;
let steveDragBaseX = 0;
let steveCurrentDragX = 0;
let steveDragging = false;
let steveDirectionLocked = false;

function isSmallScreen() {
    return window.innerWidth <= 768;
}

// Block ALL touch events on #steve from bubbling up to the parallax container.
// This is the reliable fix: stopPropagation prevents the parallax from ever
// seeing touches that originate on the chat UI, textarea, buttons, or questions.
steveEl.addEventListener('touchstart', function(e) {
    e.stopPropagation();

    if (!isSmallScreen()) return;

    // Don't set up drag for textarea or button — let them behave normally
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'textarea' || tag === 'button') return;

    const touch = e.touches[0];
    steveDragStartX = touch.clientX;
    steveDragStartY = touch.clientY;
    steveDragBaseX = steveCurrentDragX;
    steveDragging = false;       // not committed yet
    steveDirectionLocked = false;
}, { passive: true });

steveEl.addEventListener('touchmove', function(e) {
    e.stopPropagation();

    if (!isSmallScreen()) return;
    if (steveDragStartX === null) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - steveDragStartX;
    const deltaY = touch.clientY - steveDragStartY;

    // Direction lock: first 8px of movement decides horizontal drag vs vertical scroll
    if (!steveDirectionLocked) {
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
            steveDragging = Math.abs(deltaX) > Math.abs(deltaY);
            steveDirectionLocked = true;
        }
        return; // Still detecting direction
    }

    // Vertical gesture → do NOT preventDefault, let native chat scroll work
    if (!steveDragging) return;

    // Horizontal gesture → take over, prevent browser back-swipe / other gestures
    e.preventDefault();

    steveCurrentDragX = steveDragBaseX + deltaX;

    // Clamp so the UI can't be flung completely off-screen
    const maxDrag = window.innerWidth * 0.4;
    steveCurrentDragX = Math.max(-maxDrag, Math.min(maxDrag, steveCurrentDragX));

    steveEl.style.setProperty('--drag-x', `${steveCurrentDragX}px`);
}, { passive: false }); // non-passive so we can preventDefault for horizontal drags

steveEl.addEventListener('touchend', function() {
    e.stopPropagation();
    steveDragStartX = null;
    steveDragging = false;
    steveDirectionLocked = false;
}, { passive: true });

// Reset drag offset when screen resizes past the breakpoint
window.addEventListener('resize', function() {
    if (!isSmallScreen() && steveCurrentDragX !== 0) {
        steveCurrentDragX = 0;
        steveEl.style.setProperty('--drag-x', '0px');
    }
});

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

let conversationHistory = [];

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
    sendButton.disabled = true;
    chatInput.disabled = true;
    chatInput.placeholder = 'Steve is... "thinking"';
    stoneClicked.play();

    steveButton.src = "images/steve-on.png";

    setTimeout(() => {
        steveButton.src = "images/steve-off.png";
        stoneUnclicked.play();
    }, 1500);

    try {
        // Pass the conversation history to the model
        const result = await model.generateContent({
            contents: conversationHistory
        });
        const response = await result.response.text();

        // Add the AI's response to the conversation history
        conversationHistory.push({
            role: "model",
            parts: [{ text: response }]
        });

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

                const typingInterval = setInterval(() => {
                    span.textContent += subSentence[charIndex];
                    charIndex++;
                    if (charIndex === subSentence.length) {
                        clearInterval(typingInterval);
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
            const randomPause = Math.floor(Math.random() * (1000 - 700 + 1)) + 700;
            return new Promise(resolve => setTimeout(resolve, randomPause));
        }

        async function handleTypingEffect() {
            for (let sentence of sentences) {
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
                    await typeSentence(subSentence, paragraph);
                    await pause();
                }
                console.log("Steve:", sentence);
            }
            
            sendButton.disabled = false;
            chatInput.disabled = false;
            chatInput.focus();
            chatInput.placeholder = "Type your message...";
        }

        handleTypingEffect();
        
    } catch (error) {
        pEle.classList.add("gemini-response");
        console.log("Error fetching gemini response: ", error);
        pEle.innerHTML = `
        <div class="chat-body-inner text-left p-5">
            <p>Oops! Something went wrong.</p>
        </div>`;
        sendButton.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
        chatInput.placeholder = "Type your message...";
    }

    chatContainer.appendChild(pEle);
};

const handleAPI = () => {
    const userText = chatInput.value.trim();
    if(!userText) return;
    getChatResponse();
    chatInput.value = '';

    const chatBubbble = document.createElement("div");
    chatBubbble.classList.add("chat-bubble");
    chatBubbble.innerHTML = `
    <div class="chat-body-inner text-right p-5 w-5/6 ml-auto">
        <p>${userText}</p>
    </div>
    `;
    chatContainer.appendChild(chatBubbble);
    chatBox.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
    });
}

sendButton.addEventListener("click", handleAPI);

chatInput.addEventListener("keydown", (e) =>{
    if(e.key == "Enter") {
        handleAPI();
    }
});

const questionElements = document.querySelectorAll('.question');
questionElements.forEach(question => {
    question.addEventListener('click', (event) => {
        const questionText = event.target.textContent;
        chatInput.value = questionText;
        handleAPI();
    });
});
