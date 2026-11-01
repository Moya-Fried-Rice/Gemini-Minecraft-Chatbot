import {model} from "./mainmodule.js";
let x = 0;
let y = 0;
let targetX = 0;
let targetY = 0;
let time = 0; // A time variable to create periodic motion
const layers = document.querySelectorAll('#parallax-container img, #parallax-container #steve');

document.addEventListener('mousemove', function(e) {
    targetX = e.clientX / window.innerWidth;
    targetY = e.clientY / window.innerHeight;
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
const stopButton = document.querySelector("#stop-btn");
const stoneClicked = new Audio("sounds/Stone_button_press.ogg");
const stoneUnclicked = new Audio("sounds/Stone_button_unpress.ogg");

let conversationHistory = [];
let activeJob = null;

const resetChatControls = () => {
    if (activeJob?.steveTimer) {
        clearTimeout(activeJob.steveTimer);
    }
    activeJob = null;
    sendButton.disabled = false;
    chatInput.disabled = false;
    stopButton.hidden = true;
    chatInput.placeholder = "Type your message...";
    steveButton.src = "images/steve-off.png";
};

const getChatResponse = async () => {
    const message = chatInput.value;
    console.log("User:", message);

    // Add the user's message to the conversation history
    conversationHistory.push({
        role: "user",
        parts: [{ text: message }]
    });

    const pEle = document.createElement("div");
    const job = {
        controller: new AbortController(),
        cancelled: false,
        responseAdded: false,
        timers: new Set()
    };
    activeJob = job;

    sampleQuestions.style.display = 'none';
    audio.muted = false;
    audio.play();
    sendButton.disabled = true;
    chatInput.disabled = true;
    stopButton.hidden = false;
    chatInput.placeholder = 'Steve is... "thinking"';
    stoneClicked.play();

    steveButton.src = "images/steve-on.png";

    job.steveTimer = setTimeout(() => {
        steveButton.src = "images/steve-off.png";
        stoneUnclicked.play();
    }, 1500);

    try {
        // Pass the conversation history to the model
        const result = await model.generateContent({
            contents: conversationHistory,
            signal: job.controller.signal
        });
        const response = await result.response.text();

        // Add the AI's response to the conversation history
        conversationHistory.push({
            role: "model",
            parts: [{ text: response }]
        });
        job.responseAdded = true;

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
                if (job.cancelled) {
                    resolve();
                    return;
                }

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
                    if (job.cancelled) {
                        clearInterval(typingInterval);
                        resolve();
                        return;
                    }

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
                job.timers.add(typingInterval);
            });
        }

        function pause() {
            const randomPause = Math.floor(Math.random() * (1000 - 700 + 1)) + 700;
            return new Promise(resolve => {
                const timer = setTimeout(() => {
                    job.timers.delete(timer);
                    resolve();
                }, randomPause);
                job.timers.add(timer);
            });
        }

        async function handleTypingEffect() {
            for (let sentence of sentences) {
                if (job.cancelled) return;
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
                    if (job.cancelled) return;
                    await pause();
                }
                console.log("Steve:", sentence);
            }

            if (activeJob === job) {
                resetChatControls();
                chatInput.focus();
            }
        }

        handleTypingEffect();
        
    } catch (error) {
        if (job.cancelled || error.name === "AbortError") {
            if (!job.responseAdded && conversationHistory.at(-1)?.role === "user") {
                conversationHistory.pop();
            }
            return;
        }

        pEle.classList.add("gemini-response");
        console.log("Error fetching gemini response: ", error);
        pEle.innerHTML = `
        <div class="chat-body-inner text-left p-5">
            <p>Oops! Something went wrong.</p>
        </div>`;
        resetChatControls();
        chatInput.focus();
    }

    chatContainer.appendChild(pEle);
};

const stopChat = () => {
    if (!activeJob) return;

    activeJob.cancelled = true;
    activeJob.controller.abort();
    activeJob.timers.forEach(timer => {
        clearInterval(timer);
        clearTimeout(timer);
    });
    activeJob.timers.clear();
    resetChatControls();
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
stopButton.addEventListener("click", stopChat);

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
