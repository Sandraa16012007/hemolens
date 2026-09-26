export function translateReportText(text: string | null | undefined, language: string): string {
    if (!text || language !== "hi") return text || "";

    let translated = text;

    // 1. Replace common clinical report summary phrases
    translated = translated.replace(
        /Your estimated hemoglobin level of ([\d.]+)\s*g\/dL suggests a (moderate|high|low|severe) risk of an(?:ae|e)mia\./gi,
        (_, hb, risk) => {
            const riskMap: Record<string, string> = {
                moderate: "मध्यम",
                high: "उच्च",
                low: "कम",
                severe: "गंभीर",
            };
            const hindiRisk = riskMap[risk.toLowerCase()] || risk;
            return `आपका अनुमानित हीमोग्लोबिन स्तर ${hb} g/dL है जो एनीमिया के ${hindiRisk} जोखिम का संकेत देता है।`;
        }
    );

    translated = translated.replace(
        /An estimated hemoglobin level of ([\d.]+)\s*g\/dL/gi,
        "$1 g/dL का एक अनुमानित हीमोग्लोबिन स्तर"
    );

    translated = translated.replace(/suggests a moderate risk of an(?:ae|e)mia/gi, "एनीमिया के मध्यम जोखिम को दर्शाता है");
    translated = translated.replace(/suggests a high risk of an(?:ae|e)mia/gi, "एनीमिया के उच्च जोखिम को दर्शाता है");
    translated = translated.replace(/suggests a low risk of an(?:ae|e)mia/gi, "एनीमिया के कम जोखिम को दर्शाता है");
    translated = translated.replace(/indicates a moderate risk of an(?:ae|e)mia/gi, "एनीमिया के मध्यम जोखिम का संकेत देता है");
    translated = translated.replace(/indicates a high risk of an(?:ae|e)mia/gi, "एनीमिया के उच्च जोखिम का संकेत देता है");
    translated = translated.replace(/indicates a low risk of an(?:ae|e)mia/gi, "एनीमिया के कम जोखिम का संकेत देता है");

    translated = translated.replace(/Prompt medical evaluation and a confirmatory blood test are advised\./gi, "त्वरित चिकित्सा मूल्यांकन और पुष्टि के लिए रक्त परीक्षण की सलाह दी जाती है।");
    translated = translated.replace(/clinical risk classification is unavailable/gi, "नैदानिक जोखिम वर्गीकरण अनुपलब्ध है");
    translated = translated.replace(/due to incomplete demographic context\./gi, "अपूर्ण जनसांख्यिकीय संदर्भ के कारण।");
    translated = translated.replace(/UNCLASSIFIABLE/gi, "अवर्गीकृत");
    translated = translated.replace(/Unclassifiable/gi, "अवर्गीकृत");
    translated = translated.replace(/No screening history yet\. Start your first non-invasive screening today\./gi, "अभी तक कोई जांच इतिहास नहीं है। आज ही अपनी पहली गैर-आक्रामक जांच शुरू करें।");
    translated = translated.replace(/No screening records found\./gi, "कोई जांच रिकॉर्ड नहीं मिला।");
    translated = translated.replace(/Your latest estimate is lower than your first screening \(([^)]+)\)\. A routine blood test can confirm your iron levels\./gi, "आपका नवीनतम अनुमान आपकी पहली जांच से कम है ($1)। एक नियमित रक्त परीक्षण आपके आयरन के स्तर की पुष्टि कर सकता है।");
    translated = translated.replace(/Your Hb estimate is trending upward \(([^)]+)\)\. Keep up your dietary habits\./gi, "आपका हीमोग्लोबिन अनुमान ऊपर की ओर बढ़ रहा है ($1)। अपनी आहार संबंधी आदतों को बनाए रखें।");
    translated = translated.replace(/HemoLens is for health guidance only and does not replace professional medical advice\./gi, "HemoLens केवल स्वास्थ्य मार्गदर्शन के लिए है और यह पेशेवर चिकित्सा सलाह का विकल्प नहीं है।");
    translated = translated.replace(/Back to Dashboard/gi, "डैशबोर्ड पर वापस जाएं");
    translated = translated.replace(/Let's check your current anemia risk/gi, "आइए आपके वर्तमान एनीमिया जोखिम की जांच करें");
    translated = translated.replace(/Follow the steps below\. Your lower-eyelid image is verified for quality before running the screening model\./gi, "नीचे दिए गए चरणों का पालन करें। जांच मॉडल चलाने से पहले आपकी निचली पलक की फोटो की गुणवत्ता जांची जाती है।");
    translated = translated.replace(/Estimated Hb Trend/gi, "अनुमानित Hb रुझान");
    translated = translated.replace(/Trend:/gi, "रुझान:");

    return translated;
}

