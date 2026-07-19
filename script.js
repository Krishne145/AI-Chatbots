const loginSlide = document.getElementById("loginSlide");
const chatSlide = document.getElementById("chatSlide");
const enterBtn = document.getElementById("enterBtn");
const userNameInput = document.getElementById("userName");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const listenBtn = document.getElementById("listenBtn");
const chatMessages = document.getElementById("chatMessages");
const moodLabel = document.getElementById("moodLabel");
const voiceStatus = document.getElementById("voiceStatus");
const flyBtn = document.getElementById("flyBtn");
const landBtn = document.getElementById("landBtn");
const shareLink = document.getElementById("shareLink");
const exitBtn = document.getElementById("exitBtn");

let userName = localStorage.getItem("kivo-user") || "friend";
let memory = JSON.parse(localStorage.getItem("kivo-memory") || "[]");
let isListening = false;
let recognition = null;
let robotMode = "resting";
let autoListenEnabled = false;
let activeLanguage = localStorage.getItem("kivo-language") || "english";
let pendingQuestion = false;
let conversationState = "idle";
let isReplying = false;
let voiceTurnLocked = false;
let lastVoiceTranscript = "";
let lastSpeechText = "";

if (window.SpeechRecognition || window.webkitSpeechRecognition) {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognitionCtor();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 5;

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) {
        transcript += result[0].transcript + " ";
      }
    }
    transcript = transcript.trim();

    if (transcript) {
      const corrected = transcript
        .replace(/\bthier\b/gi, "their")
        .replace(/\bteh\b/gi, "the")
        .replace(/\bwhot\b/gi, "what")
        .replace(/\bwat\b/gi, "what")
        .replace(/\bim\b/gi, "i'm")
        .replace(/\s+/g, " ");
      const normalized = corrected.toLowerCase().trim();
      if (!normalized || voiceTurnLocked || normalized === lastVoiceTranscript.toLowerCase()) {
        return;
      }
      voiceTurnLocked = true;
      lastVoiceTranscript = corrected;
      autoListenEnabled = false;
      isListening = false;
      updateRobotState("active");
      setVoiceStatus("Heard you. KIVO is replying...");
      handleSend(corrected, true);
    } else {
      setVoiceStatus("Listening... speak clearly.");
    }
  };

  recognition.onerror = () => {
    isListening = false;
    updateRobotState("resting");
    setVoiceStatus("Voice input paused. Tap the mic when you want to speak.");
  };

  recognition.onend = () => {
    if (isListening && !voiceTurnLocked) {
      try {
        recognition.start();
      } catch (error) {}
    } else {
      updateRobotState("resting");
      setVoiceStatus("Tap the mic to speak when you want.");
    }
  };
}

function escapeHTML(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAssistantEmoji(text) {
  const lower = normalizeText(text);
  if (/hello|hi|hey|namaste|welcome/.test(lower)) return "👋";
  if (/music|song|play/.test(lower)) return "🎵";
  if (/recipe|cook|food|tea|pizza|pav|pakora/.test(lower)) return "🍳";
  if (/solve|math|calculate|[+\-*/]/.test(lower)) return "🧮";
  if (/open|launch|whatsapp|facebook|instagram|youtube|google|amazon|github|gmail|linkedin|chrome/.test(lower)) return "📱";
  if (/sorry|not aware|apolog/i.test(lower)) return "😔";
  if (/bye|goodbye|exit|shubh/.test(lower)) return "👋";
  return "🤖";
}

function addMessage(text, side) {
  const bubble = document.createElement("div");
  bubble.className = `message ${side}`;
  const visualPrefix = side === "assistant" ? `${getAssistantEmoji(text)} ` : "✨ ";
  bubble.innerHTML = `<p>${escapeHTML(visualPrefix + text)}</p>`;
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setVoiceStatus(text) {
  if (voiceStatus) {
    voiceStatus.textContent = text;
  }
}

function getPreferredVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((voice) => /female|girl|samantha|susan|zira|victoria|google.*female|en-us|en-gb|hi-in|te-in|mr-in/i.test(voice.name)) || voices.find((voice) => voice.lang.startsWith("en")) || voices[0];
  return preferred || null;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  if (!text || text === lastSpeechText) return;
  lastSpeechText = text;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getPreferredVoice();
  if (voice) {
    utterance.voice = voice;
  }
  utterance.lang = activeLanguage === "hindi" ? "hi-IN" : activeLanguage === "telugu" ? "te-IN" : activeLanguage === "marathi" ? "mr-IN" : "en-US";
  utterance.rate = 1.1;
  utterance.pitch = 1.2;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function updateRobotState(state) {
  const robot = document.querySelector(".robot");
  if (!robot) return;
  robot.classList.remove("active", "listening", "resting");
  robot.classList.add(state);
  robotMode = state;
}

function startAutoListening() {
  if (!recognition) {
    setVoiceStatus("Voice input is not supported here.");
    return;
  }
  voiceTurnLocked = false;
  lastVoiceTranscript = "";
  autoListenEnabled = true;
  isListening = true;
  setVoiceStatus("Listening... speak clearly and steadily.");
  updateRobotState("listening");
  try {
    recognition.start();
  } catch (error) {}
}

function stopAutoListening() {
  if (!recognition) return;
  autoListenEnabled = false;
  isListening = false;
  recognition.stop();
  setVoiceStatus("Listening paused.");
  updateRobotState("resting");
}

function detectEmotion(text) {
  const lower = text.toLowerCase();
  if (/(sad|lonely|depressed|hurt|cry|upset|angry|mad|anxious|afraid|worried|stress|tired)/.test(lower)) {
    return { mood: "soft", line: "I can feel that you are carrying something heavy. I am with you, and I will stay gentle." };
  }
  if (/(happy|excited|love|glad|awesome|amazing|great|joy|smile)/.test(lower)) {
    return { mood: "bright", line: "That sounds wonderful. Your energy is bright, and I’m glad to share it with you." };
  }
  return { mood: "curious", line: "I’m listening closely, and I’m ready to help you with warmth and focus." };
}

function setLanguage(mode) {
  activeLanguage = mode;
  localStorage.setItem("kivo-language", mode);
  const messages = {
    english: "English mode activated.",
    hindi: "हिंदी मोड सक्रिय है।",
    telugu: "తెలుగు మోడ్ క్రియాశీలంగా ఉంది।",
    marathi: "मराठी मोड सक्रिय आहे।"
  };
  speak(messages[mode]);
  return messages[mode];
}

function normalizeText(text) {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function getExactReply(text) {
  const lower = normalizeText(text);
  const safeName = userName || "friend";
  const now = new Date();

  if (["what is your name", "what is your name?", "who are you", "who are you?", "who are u", "who are u?"].includes(lower)) {
    return activeLanguage === "hindi"
      ? "मेरा नाम KIVO है। मैं आपका रोबोट सहायक हूँ।"
      : activeLanguage === "telugu"
      ? "నా పేరు KIVO. నేను మీ రోబో సహాయకుణ్ణి."
      : activeLanguage === "marathi"
      ? "माझं नाव KIVO आहे. मी तुमचा रोबोट सहायक आहे."
      : "My name is KIVO. I am your robot assistant.";
  }

  if (["what is my name", "what is my name?", "what is my name please", "what is my name please?"].includes(lower)) {
    return activeLanguage === "hindi"
      ? `आपका नाम ${safeName} है।`
      : activeLanguage === "telugu"
      ? `మీ పేరు ${safeName}.`
      : activeLanguage === "marathi"
      ? `तुमचं नाव ${safeName} आहे.`
      : `Your name is ${safeName}.`;
  }

  if (["what can you do", "what can you do?", "what are you able to do", "what are you able to do?"].includes(lower)) {
    return activeLanguage === "hindi"
      ? "मैं आपकी मदद कर सकता हूँ: सवालों के जवाब देना, जानकारी याद रखना, पढ़ाई में मदद करना, रेसिपी बताना, और अंग्रेज़ी, हिंदी, तेलुगु, मराठी में बात करना।"
      : activeLanguage === "telugu"
      ? "నేను మీకు సహాయం చేయగలను: ప్రశ్నలకు సమాధానం ఇవ్వడం, సమాచారం గుర్తుంచడం, చదువులో సహాయం చేయడం, రెసిపీలు చెప్పడం, మరియు ఇంగ్లీష్, హిందీ, తెలుగు, మరాఠీలో మాట్లాడటం."
      : activeLanguage === "marathi"
      ? "मी तुमची मदत करू शकतो: प्रश्नांची उत्तरे देणे, माहिती लक्षात ठेवणे, अभ्यासात मदत करणे, रेसिपी सांगणे, आणि इंग्रजी, हिंदी, तेलुगु, मराठीत बोलणे."
      : "I can help you answer questions, remember details, help with study, share recipes, and speak in English, Hindi, Telugu, and Marathi.";
  }

  if (["what is the time", "what time is it", "what time is it?", "time", "time?"].includes(lower)) {
    return activeLanguage === "hindi"
      ? `वर्तमान समय ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} है।`
      : activeLanguage === "telugu"
      ? `ప్రస్తుత సమయం ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
      : activeLanguage === "marathi"
      ? `सध्याचा वेळ ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} आहे.`
      : `The current time is ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
  }

  if (["what is the date", "what date is it", "what date is it?", "date", "date?"].includes(lower)) {
    return activeLanguage === "hindi"
      ? `आज की तारीख ${now.toLocaleDateString("en-IN")} है।`
      : activeLanguage === "telugu"
      ? `నేడు తేదీ ${now.toLocaleDateString("en-IN")}.`
      : activeLanguage === "marathi"
      ? `आजची तारीख ${now.toLocaleDateString("en-IN")} आहे.`
      : `Today’s date is ${now.toLocaleDateString()}.`;
  }

  if (["which languages do you speak", "what languages do you speak", "what languages do you speak?", "which languages do you speak?"].includes(lower)) {
    return activeLanguage === "hindi"
      ? "मैं अंग्रेज़ी, हिंदी, तेलुगु और मराठी बोल सकता हूँ।"
      : activeLanguage === "telugu"
      ? "నేను ఇంగ్లీష్, హిందీ, తెలుగు మరియు మరాఠీ మాట్లాడగలను."
      : activeLanguage === "marathi"
      ? "मी इंग्रजी, हिंदी, तेलुगु आणि मराठी बोलू शकतो."
      : "I can speak English, Hindi, Telugu, and Marathi.";
  }

  return null;
}

function evaluateMathExpression(text) {
  const lower = normalizeText(text);
  const exprMatch = lower.match(/([0-9.]+(?:\s*[+\-*/x×÷]\s*[0-9.]+)+)/i);
  if (!exprMatch) return null;

  let expr = exprMatch[1]
    .replace(/x/g, "*")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "");

  const sanitized = expr.replace(/[^0-9+\-*/().]/g, "");
  if (!sanitized) return null;

  try {
    const result = Function(`"use strict"; return (${sanitized});`)();
    if (Number.isFinite(result)) {
      return { expression: expr, result };
    }
  } catch (error) {
    return null;
  }
  return null;
}

function openAppByName(name) {
  const targets = {
    whatsapp: "https://web.whatsapp.com/",
    facebook: "https://www.facebook.com/",
    instagram: "https://www.instagram.com/",
    youtube: "https://www.youtube.com/",
    google: "https://www.google.com/",
    amazon: "https://www.amazon.com/",
    github: "https://github.com/",
    gmail: "https://mail.google.com/",
    linkedin: "https://www.linkedin.com/",
    chrome: "https://www.google.com/"
  };
  const normalized = (name || "").toLowerCase();
  const matched = Object.keys(targets).find((key) => normalized.includes(key));
  if (!matched) return false;
  window.open(targets[matched], "_blank", "noopener,noreferrer");
  return true;
}

function getLeaderReply(text) {
  const lower = normalizeText(text);
  const data = {
    india: { president: "Droupadi Murmu", primeMinister: "Narendra Modi" },
    "united states": { president: "Donald Trump", primeMinister: "There is no prime minister; the U.S. has a President." },
    usa: { president: "Donald Trump", primeMinister: "There is no prime minister; the U.S. has a President." },
    "united kingdom": { president: "There is no president; the UK has a monarch and a Prime Minister.", primeMinister: "Keir Starmer" },
    uk: { president: "There is no president; the UK has a monarch and a Prime Minister.", primeMinister: "Keir Starmer" },
    france: { president: "Emmanuel Macron", primeMinister: "François Bayrou" },
    germany: { president: "Frank-Walter Steinmeier", chancellor: "Friedrich Merz" },
    china: { president: "Xi Jinping", primeMinister: "Li Qiang" },
    japan: { primeMinister: "Shigeru Ishiba" },
    russia: { president: "Vladimir Putin", primeMinister: "Mikhail Mishustin" },
    canada: { primeMinister: "Mark Carney" },
    australia: { primeMinister: "Anthony Albanese" },
    brazil: { president: "Luiz Inácio Lula da Silva" },
    italy: { president: "Sergio Mattarella", primeMinister: "Giorgia Meloni" },
    spain: { primeMinister: "Pedro Sánchez" },
    "south africa": { president: "Cyril Ramaphosa" }
  };

  const countryMatch = lower.match(/(president|prime minister|pm) of (.+)$/i);
  if (!countryMatch) return null;
  const role = countryMatch[1].toLowerCase();
  const countryInput = countryMatch[2].trim().replace(/\s+/g, " ");
  const countryKey = countryInput.replace(/the /i, "").toLowerCase();
  const entry = data[countryKey];
  if (!entry) return null;
  if (role === "president") {
    return entry.president || `I do not have the president for ${countryInput} in my current knowledge list.`;
  }
  return entry.primeMinister || entry.chancellor || `I do not have the prime minister for ${countryInput} in my current knowledge list.`;
}

function getGeneralKnowledgeReply(text) {
  const lower = normalizeText(text);
  const now = new Date();
  const currentYear = now.getFullYear();

  if (/(capital of india|capital city of india|capital of india\?)/.test(lower)) {
    return activeLanguage === "hindi" ? "भारत की राजधानी नई दिल्ली है।" : activeLanguage === "telugu" ? "భారత రాజధాని న్యూ డిల్లీ." : activeLanguage === "marathi" ? "भारताची राजधानी नवी दिल्ली आहे." : "The capital of India is New Delhi.";
  }

  if (/(capital of maharashtra|capital of maharashtra\?)/.test(lower)) {
    return activeLanguage === "hindi" ? "महाराष्ट्र की राजधानी मुंबई है।" : activeLanguage === "telugu" ? "మహారాష్ట్ర రాజధాని ముంబై." : activeLanguage === "marathi" ? "महाराष्ट्राची राजधानी मुंबई आहे." : "The capital of Maharashtra is Mumbai.";
  }

  if (/(currency of india|currency of india\?)/.test(lower)) {
    return activeLanguage === "hindi" ? "भारत की मुद्रा रुपया है।" : activeLanguage === "telugu" ? "భారత కరెన్సీ రూపాయి." : activeLanguage === "marathi" ? "भारताची चलनरुपी रुपया आहे." : "The currency of India is the Indian Rupee.";
  }

  if (/(largest planet|which planet is biggest|which planet is the largest)/.test(lower)) {
    return activeLanguage === "hindi" ? "सबसे बड़ा ग्रह बृहस्पति है।" : activeLanguage === "telugu" ? "అత్యంత పెద్ద గ్రహం బృహస్పతి." : activeLanguage === "marathi" ? "सर्वात मोठा ग्रह बृहस्पती आहे." : "The largest planet is Jupiter.";
  }

  if (/(red planet|which planet is known as the red planet)/.test(lower)) {
    return activeLanguage === "hindi" ? "लाल ग्रह मंगल है।" : activeLanguage === "telugu" ? "ఎర్ర గ్రహం మార్స్." : activeLanguage === "marathi" ? "लाल ग्रह मंगळ आहे." : "The red planet is Mars.";
  }

  if (/(capital of france|capital of france\?)/.test(lower)) {
    return activeLanguage === "hindi" ? "फ्रांस की राजधानी पेरिस है।" : activeLanguage === "telugu" ? "ఫ్రాన్స్ రాజధాని పారిస్." : activeLanguage === "marathi" ? "फ्रान्सची राजधानी पॅरिस आहे." : "The capital of France is Paris.";
  }

  if (/(who won the fifa world cup 2022|fifa world cup 2022|world cup 2022)/.test(lower)) {
    return activeLanguage === "hindi" ? "2022 फीफा विश्व कप अर्जेंटीना ने जीता।" : activeLanguage === "telugu" ? "2022 FIFA ప్రపంచ కప్ ఆర్జెంటీనా గెలుచుకుంది." : activeLanguage === "marathi" ? "2022 FIFA विश्वचषक अर्जेंटिना ने जिंकला." : "Argentina won the FIFA World Cup 2022.";
  }

  if (/(who won the cricket world cup 2023|cricket world cup 2023|world cup 2023)/.test(lower)) {
    return activeLanguage === "hindi" ? "2023 आईसीसी क्रिकेट विश्व कप ऑस्ट्रेलिया ने जीता।" : activeLanguage === "telugu" ? "2023 ICC క్రికెట్ ప్రపంచ కప్ ఆస్ట్రేలియా గెలుచుకుంది." : activeLanguage === "marathi" ? "2023 ICC क्रिकेट विश्वचषक ऑस्ट्रेलियाने जिंकला." : "Australia won the ICC Cricket World Cup 2023.";
  }

  if (/(president of|prime minister of|pm of|who is the president of|who is the prime minister of)/.test(lower)) {
    const leaderReply = getLeaderReply(text);
    if (leaderReply) {
      return activeLanguage === "hindi" ? `${leaderReply}` : activeLanguage === "telugu" ? `${leaderReply}` : activeLanguage === "marathi" ? `${leaderReply}` : `${leaderReply}`;
    }
  }

  if (/(what year is it|current year|what is the current year|year 2026|year 2025|year 2024|year 2023|year 2022|year 2021|year 2020)/.test(lower)) {
    return activeLanguage === "hindi" ? `वर्तमान वर्ष ${currentYear} है।` : activeLanguage === "telugu" ? `ప్రస్తుత సంవత్సరం ${currentYear}.` : activeLanguage === "marathi" ? `सध्याचा वर्ष ${currentYear} आहे.` : `The current year is ${currentYear}.`;
  }

  return null;
}

function getResponse(text) {
  const lower = normalizeText(text);
  const emotion = detectEmotion(lower);
  const safeName = userName || "friend";
  const exactReply = getExactReply(text);
  if (exactReply) {
    return exactReply;
  }

  const generalReply = getGeneralKnowledgeReply(text);
  if (generalReply) {
    return generalReply;
  }

  if (!lower) {
    return activeLanguage === "hindi" ? "मैं यहाँ हूँ। आप क्या चाहते हैं?" : activeLanguage === "telugu" ? "నేను ఇక్కడ ఉన్నాను. మీరు ఏమి కోరుకుంటున్నారు?" : activeLanguage === "marathi" ? "मी येथे आहे. तू काय चाहता आहेस?" : "I’m here. Please tell me what you need.";
  }

  if (/(activate english|english mode|switch to english|set english)/.test(lower)) {
    return setLanguage("english");
  }
  if (/(activate hindi|hindi mode|switch to hindi|set hindi|हिंदी|हिन्दी)/.test(lower)) {
    return setLanguage("hindi");
  }
  if (/(activate telugu|telugu mode|switch to telugu|set telugu|తెలుగు)/.test(lower)) {
    return setLanguage("telugu");
  }
  if (/(activate marathi|marathi mode|switch to marathi|set marathi|मराठी)/.test(lower)) {
    return setLanguage("marathi");
  }

  if (/(hello|hi|hey|good morning|good evening|good afternoon|hi there|नमस्ते|हैलो|सुप्रभात|शुभ दोपहर|शुभ संध्या)/.test(lower)) {
    const englishReply = `Namaste ${safeName}! I am KIVO, your friendly robot companion. I can understand your feelings, remember details, help with study, answer questions clearly, and greet you warmly.`;
    const hindiReply = `नमस्ते ${safeName}! मैं KIVO हूँ, आपका मित्रवत रोबोट सहायक। मैं आपकी भावनाओं को समझ सकता हूँ, जानकारी याद रख सकता हूँ, पढ़ाई में मदद कर सकता हूँ, सवालों के स्पष्ट जवाब दे सकता हूँ, और आपको विनम्रता से अभिवादन कर सकता हूँ।`;
    const teluguReply = `నమస్తే ${safeName}! నేను KIVO, మీ స్నేహపూర్వక రోబో సహాయకుణ్ణి. నేను మీ భావాలను అర్థం చేసుకోగలను, వివరాలను గుర్తుపెట్టగలను, చదువులో సహాయం చేయగలను, ప్రశ్నలకు స్పష్టంగా సమాధానం ఇవ్వగలను, మరియు మీకు హృదయపూర్వకంగా నమస్కారం చేయగలను.`;
    const marathiReply = `नमस्ते ${safeName}! मी KIVO आहे, तुमचा मैत्रीपूर्ण रोबोट सहायक. मी तुमच्या भावना समजू शकतो, माहिती लक्षात ठेवू शकतो, अभ्यासात मदत करू शकतो, प्रश्नांना स्पष्ट उत्तर देऊ शकतो, आणि तुमला विनम्रपणे अभिवादन करू शकतो.`;
    return activeLanguage === "hindi" ? hindiReply : activeLanguage === "telugu" ? teluguReply : activeLanguage === "marathi" ? marathiReply : englishReply;
  }

  if (/(thank you|thanks|thankyou|thanks a lot|धन्यवाद|धन्यबाद|साहेब|shukriya|sukriya|స్వాగతం|ధన్యవాదాలు|धन्यवाद!|thank you!)/.test(lower)) {
    return activeLanguage === "hindi"
      ? "यह मेरे लिए खुशी की बात है। मैं आपकी मदद करके खुश हूँ।"
      : activeLanguage === "telugu"
      ? "ఇది నా కృషి, మరియు మీకు సహాయం చేయడం నాకు ఆనందంగా ఉంది."
      : activeLanguage === "marathi"
      ? "ते मला आनंददायी आहे. मी तुमची मदत करण्यास आनंद होतो."
      : "It’s my pleasure to help you.";
  }

  if (/(what is your name|who are you|introduce yourself|तुम्हारा नाम क्या है|आप कौन हैं|आप कौन सी चीज़ हैं|तू कौन आहे|तू कोण आहे|నువ్వు ఎవరు|మీ పేరు ఏమిటి)/.test(lower)) {
    return activeLanguage === "hindi" ? "मैं KIVO हूँ, एक बुद्धिमान, भावनाओं को समझने वाला, याद रखने वाला और हिंदी, अंग्रेज़ी, तेलुगु, और मराठी में बात करने वाला रोबोट सहायक हूँ।" : activeLanguage === "telugu" ? "నేను KIVO, ఒక తెలివైన, భావాలను అర్థం చేసుకునే, గుర్తుంచుకునే, మరియు ఇంగ్లీష్, హిందీ, తెలుగు, మరాఠీలో మాట్లాడే రోబో సహాయకుణ్ణి." : activeLanguage === "marathi" ? "मी KIVO आहे, एक बुद्धिमान, भावना समजणारा, आठवण ठेवणारा आणि इंग्रजी, हिंदी, तेलुगु आणि मराठीमध्ये बोलणारा रोबोट सहायक आहे." : "I am KIVO, an intelligent assistant that understands emotions, remembers information, and speaks in English, Hindi, Telugu, and Marathi.";
  }

  if (/(how are you|how do you feel|what is your mood|आप कैसे हैं|आप कैसा महसूस कर रहे हैं|तू कसा आहेस|మీ ఎలా ఉన్నారు)/.test(lower)) {
    return activeLanguage === "hindi" ? `मैं अच्छा हूँ, ${safeName}. मैं आपकी बात सुन रहा हूँ और आपकी मदद के लिए यहाँ हूँ।` : activeLanguage === "telugu" ? `నేను బాగున్నాను, ${safeName}. నేను మీ మాట వినడానికి సిద్ధంగా ఉన్నాను.` : activeLanguage === "marathi" ? `मी ठीक आहे, ${safeName}. मी तुमची बात ऐकण्यासाठी तयार आहे.` : `I am doing well, ${safeName}. I am ready to listen to you.`;
  }

  if (/(i am happy|i feel happy|i am sad|i feel sad|i am upset|i feel upset|i am excited|i feel excited|i am tired|i feel tired|मैं खुश हूँ|मैं उदास हूँ|मैं दुखी हूँ|मुझे दुख है|मैं थका हुआ हूँ|मुझे थकान है|నేను సంతోషంగా ఉన్నాను|నేను బాధపడ్డాను|నేను అలసిపోతున్నాను|मी आनंदी आहे|मी उदास आहे|मी त्रस्त आहे)/.test(lower)) {
    return activeLanguage === "hindi" ? "मैं आपके साथ हूँ। थोड़ा साँस लें और बताइए, मैं आपकी मदद कर सकता हूँ।" : activeLanguage === "telugu" ? "నేను మీ sideలో ఉన్నాను. శ్వాస పీల్చుకోండి, నేను आपकी సహాయం చేసుకోవచ్చు." : activeLanguage === "marathi" ? "मी तुमच्यासोबत आहे. थोडा श्वास घ्या, मी तुमची मदत करू शकतो." : "I am with you. Take a breath and tell me what you need.";
  }

  if (/(recipe|recipes|how to cook|cooking|what should i cook|खाना बनाना|रेसिपी|खाना|व्यंजन|विधी)/.test(lower)) {
    return activeLanguage === "hindi" ? "मैं आपके लिए कई आसान रेसिपी याद रख सकता हूँ। उदाहरण: पिज़्ज़ा, पावभाजी, चाय, पनीर टिक्का, और पकोड़ा। आप कोई एक नाम बताइए।" : activeLanguage === "telugu" ? "నేను మీ కోసం అనేక సులభమైన రెసిపీలు గుర్తుంచగలను. ఉదాహరణ: పిజ్జా, పావ్భజీ, చాయ్, పనీర్ టిక్కా, మరియు బజ్జీ." : activeLanguage === "marathi" ? "मी तुमच्यासाठी अनेक सोप्या रेसिपी लक्षात ठेवू शकतो. उदाहरण: पिझ्झा, पावभाजी, चहा, पनीर टिक्का आणि पकौड़ा." : "I can remember many simple recipes for you. For example: pizza, pav bhaji, tea, paneer tikka, and pakora. Tell me one name and I can help.";
  }

  const mathResult = evaluateMathExpression(text);
  if (mathResult) {
    return activeLanguage === "hindi" ? `${mathResult.expression} = ${mathResult.result}` : activeLanguage === "telugu" ? `${mathResult.expression} = ${mathResult.result}` : activeLanguage === "marathi" ? `${mathResult.expression} = ${mathResult.result}` : `${mathResult.expression} = ${mathResult.result}`;
  }

  if (/(math|mathematics|solve|equation|quadratic|derivative|integral|algebra|geometry|trigonometry|गणित|समीकरण|उदाहरण|व्याख्या)/.test(lower)) {
    return activeLanguage === "hindi" ? "मैं गणित में मदद कर सकता हूँ। कृपया 5 + 3 या 8 / 2 जैसे सरल सवाल बताइए।" : activeLanguage === "telugu" ? "గణితంలో నేను సహాయం చేయగలను. 5 + 3 లేదా 8 / 2 వంటి సరళ ప్రశ్నలు చెప్పండి." : activeLanguage === "marathi" ? "मी गणितात मदत करू शकतो. 5 + 3 किंवा 8 / 2 सारखे सोपे प्रश्न सांग." : "I can help with mathematics. Please give me a simple expression such as 5 + 3 or 8 / 2.";
  }

  if (/(english|grammar|vocabulary|essay|lesson|poem|speech|अंग्रेज़ी|व्याकरण|शब्दावली|निबंध|पद्य|भाषण)/.test(lower)) {
    return activeLanguage === "hindi" ? "मैं अंग्रेज़ी सिखा सकता हूँ। आप grammar, vocabulary, essay, poem या speech में से कोई भी विषय चुनें।" : activeLanguage === "telugu" ? "నేను ఇంగ్లీష్ బోధించగలను. Grammar, vocabulary, essay, poem లేదా speech లో ఏదైనా అంశం ఎన్నుకోండి." : activeLanguage === "marathi" ? "मी इंग्रजी शिकवू शकतो. Grammar, vocabulary, essay, poem किंवा speech यापैकी कोणताही विषय निवडा." : "I can teach English. Choose grammar, vocabulary, essays, poems, or speech practice.";
  }

  if (/(open|launch|go to|visit|start)\s+(whatsapp|facebook|instagram|youtube|google|amazon|github|gmail|linkedin|chrome)/.test(lower)) {
    const appName = lower.match(/(whatsapp|facebook|instagram|youtube|google|amazon|github|gmail|linkedin|chrome)/i)[1];
    if (openAppByName(appName)) {
      return activeLanguage === "hindi" ? `${appName} खोल दिया गया है।` : activeLanguage === "telugu" ? `${appName} తెరిచాను.` : activeLanguage === "marathi" ? `${appName} उघडले आहे.` : `${appName} opened.`;
    }
  }

  if (/(song|songs|play music|play song|music|play the song|play a song|गाना|गीत|संगीत)/.test(lower)) {
    const query = lower
      .replace(/^(play|start|launch|open)\s+/i, "")
      .replace(/\b(the|a|an|song|music|track|gaana|gana|गीत|गाना|संगीत)\b/gi, "")
      .trim();
    const term = query || "popular song";
    const musicUrl = `https://music.youtube.com/search?q=${encodeURIComponent(term)}`;
    window.open(musicUrl, "_blank", "noopener,noreferrer");
    return activeLanguage === "hindi" ? `मैंने ${term} के लिए संगीत खोल दिया है।` : activeLanguage === "telugu" ? `నేను ${term} కోసం సంగీతాన్ని తెరిచాను.` : activeLanguage === "marathi" ? `मी ${term} साठी संगीत उघडले आहे.` : `I opened music for ${term} in a new tab.`;
  }

  if (/(remember that|remember)/.test(lower)) {
    const fact = lower.replace(/^(remember that|remember)\s+/i, "").trim();
    if (fact) {
      memory.push(fact);
      localStorage.setItem("kivo-memory", JSON.stringify(memory));
      return activeLanguage === "hindi" ? `मैंने यह याद रख लिया है।` : activeLanguage === "telugu" ? `నేను దానిని గుర్తుంచాను.` : activeLanguage === "marathi" ? `मी ते लक्षात ठेवले आहे.` : `I have saved that in my memory.`;
    }
    return activeLanguage === "hindi" ? `मैं आपकी जानकारी याद रख सकता हूँ।` : activeLanguage === "telugu" ? `నేను మీ సమాచారాన్ని గుర్తుంచగలను.` : activeLanguage === "marathi" ? `मी तुमची माहिती लक्षात ठेवू शकतो.` : `I can remember your information.`;
  }

  if (/(memory|what do you remember|remember anything|याद रखो|याद है|याद है क्या|గుర్తుంచగలవా|लक्षात आहे)/.test(lower)) {
    if (memory.length) {
      return activeLanguage === "hindi" ? `मैंने याद रखा है: ${memory.slice(-4).join(" • ")}` : activeLanguage === "telugu" ? `నేను గుర్తుంచినవి: ${memory.slice(-4).join(" • ")}` : activeLanguage === "marathi" ? `मी लक्षात ठेवलेले आहे: ${memory.slice(-4).join(" • ")}` : `I remember: ${memory.slice(-4).join(" • ")}`;
    }
    return activeLanguage === "hindi" ? `मैं अभी बहुत कुछ याद नहीं रखता।` : activeLanguage === "telugu" ? `నేను ఇప్పటికీ ఎక్కువగా గుర్తుంచలేదు.` : activeLanguage === "marathi" ? `मी अजून खूप काही लक्षात ठेवलेले नाही.` : `I have not remembered much yet.`;
  }

  if (/(bye|goodbye|see you|exit|बाय|अलविदा|विदा|విడుదల|निघा)/.test(lower)) {
    return activeLanguage === "hindi" ? `अलविदा! आपका दिन शुभ हो।` : activeLanguage === "telugu" ? `విడుదల! మీ రోజు శుభంగా ఉండాలి.` : activeLanguage === "marathi" ? `लवकरच भेटू! तुमचा दिवस शुभ असो.` : `Goodbye! Aapka din shubh ho.`;
  }

  return activeLanguage === "hindi" ? `नेटवर्क समस्या है। कृपया फिर से कोशिश करें।` : activeLanguage === "telugu" ? `నెట్‌వర్క్ సమస్య ఉంది. దయచేసి మళ్ళీ ప్రయత్నించండి.` : activeLanguage === "marathi" ? `नेटवर्क समस्या आहे. कृपया पुन्हा प्रयत्न करा.` : `Network problem. Please try again.`;
}

function handleSend(textOverride = "", fromVoice = false) {
  const userText = (textOverride || chatInput.value).trim();
  if (!userText) return;

  if (pendingQuestion || isReplying) {
    return;
  }

  pendingQuestion = true;
  isReplying = true;
  conversationState = "processing";
  addMessage(userText, "user");
  if (!fromVoice) {
    chatInput.value = "";
  }

  const reply = getResponse(userText);
  setTimeout(() => {
    addMessage(reply, "assistant");
    speak(reply);
    moodLabel.textContent = `Active · ${userText.length > 20 ? "thoughtful" : "listening"}`;
    updateRobotState("active");
    if (recognition) {
      try {
        recognition.stop();
      } catch (error) {}
    }
    autoListenEnabled = false;
    isListening = false;
    updateRobotState("resting");
    pendingQuestion = false;
    isReplying = false;
    conversationState = "idle";
    voiceTurnLocked = true;
    lastVoiceTranscript = "";
  }, 180);
}

function toggleVoiceInput() {
  if (!recognition) {
    setVoiceStatus("Voice input is not supported here. Try typing instead.");
    return;
  }

  if (isListening) {
    stopAutoListening();
    return;
  }

  startAutoListening();
}

enterBtn.addEventListener("click", () => {
  const typedName = userNameInput.value.trim();
  if (typedName) {
    userName = typedName;
    localStorage.setItem("kivo-user", typedName);
  }

  loginSlide.classList.remove("active");
  chatSlide.classList.add("active");
  conversationState = "idle";
  addMessage(`Namaste ${userName}! I am KIVO, and I am ready to help you with warmth and clarity.`, "assistant");
  updateRobotState("active");
  setVoiceStatus("Tap the mic to speak when you want.");
  speak(`Namaste ${userName}! I am KIVO, and I am ready to help you with warmth and clarity.`);
});

sendBtn.addEventListener("click", () => handleSend());
listenBtn.addEventListener("click", toggleVoiceInput);
exitBtn.addEventListener("click", () => {
  const goodbyeMessage = "aapka din shubh rahe";
  addMessage(goodbyeMessage, "assistant");
  speak(goodbyeMessage);
  setTimeout(() => {
    window.close();
  }, 800);
});
flyBtn.addEventListener("click", () => {
  updateRobotState("active");
  speak(activeLanguage === "hindi" ? "KIVO उड़ान मोड में है।" : activeLanguage === "telugu" ? "KIVO ఫ్లైట్ మోడ్‌లో ఉంది." : activeLanguage === "marathi" ? "KIVO उड्डाण मोडमध्ये आहे." : "KIVO is in flight mode.");
});
landBtn.addEventListener("click", () => {
  updateRobotState("resting");
  speak(activeLanguage === "hindi" ? "KIVO ने लैंड किया।" : activeLanguage === "telugu" ? "KIVO ల్యాండ్ అయ్యింది." : activeLanguage === "marathi" ? "KIVO उतरला." : "KIVO has landed.");
});
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleSend();
  }
});

userNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    enterBtn.click();
  }
});

if (shareLink) {
  const currentUrl = window.location.href;
  shareLink.href = currentUrl;
  shareLink.textContent = currentUrl;
}

if (userName) {
  userNameInput.value = userName;
}
