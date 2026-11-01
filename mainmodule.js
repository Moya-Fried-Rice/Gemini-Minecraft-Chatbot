const model = {
    async generateContent({ contents, signal }) {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
            signal
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