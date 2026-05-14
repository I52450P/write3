exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "只允许 POST 请求" }) };
    }
    const body = JSON.parse(event.body);
    const { input } = body;
    if (!input || typeof input !== "string") {
        return { statusCode: 400, body: JSON.stringify({ error: "请提供要改写的英文句子" }) };
    }

    const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
    const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
    const prompt = `你是英语写作教练。首先判断以下英文句子是否已经是地道的英语（美式风格），没有中式英语、语法错误或搭配不当。
如果句子已经非常地道，请严格按以下格式输出（不要包含任何其他内容）：
[CORRECT]
一句鼓励用户的话（中文，友善夸奖）
建议：一句针对如何进一步提升英语写作的建议（中文）

如果句子有中式英语或不够地道，请按以下格式输出：
[改写后的地道英语句子]
Explanation: [用中文详细解释：具体哪里不地道、为什么，以及改写的理由。解释要包含错误类型（如搭配不当、直译、语法错误）和改写要点，控制在 50-100 字]

用户句子：${input}`;

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ZHIPU_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ model: "glm-4-flash", messages: [{ role: "user", content: prompt }], temperature: 0.3 })
        });
        if (!response.ok) return { statusCode: 502, body: JSON.stringify({ error: "AI 服务暂时不可用" }) };
        const data = await response.json();
        const raw = data.choices[0].message.content.trim();
        if (raw.startsWith("[CORRECT]")) {
            const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
            const encouragement = lines[1] || '你的英语表达很棒！';
            let suggestion = '可以尝试用更地道的表达或更丰富的词汇。';
            if (lines[2]) suggestion = lines[2].startsWith('建议：') ? lines[2].slice(3).trim() : lines[2];
            return { statusCode: 200, body: JSON.stringify({ type: "correct", encouragement, suggestion }) };
        } else {
            return { statusCode: 200, body: JSON.stringify({ type: "rewritten", result: raw }) };
        }
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: "内部错误，请稍后再试" }) };
    }
};