const model = {
    async generateContent(options, signal) {
        const contents = options.contents;
        const fetchSignal = signal || options.signal;
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
            signal: fetchSignal
        });

        if (!response.ok) {
            throw new Error(`Chat API request failed with status ${response.status}`);
        }

        const data = await response.json();
        return {
            response: {
                text: () => data.text
            }
        };
    }
};

export { model };
