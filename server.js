const express = require("express");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const OpenAI = require("openai");
require('dotenv').config();

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
app.use(bodyParser.json());
app.use(fileUpload());

// creating session to remember and differenciate b/w diff users so that each user context remains to them
const sessions = {};
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// to start the session
app.post("/start-session", (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = {
    chatHistory: [],
    uploadedFileContent: null,
  };
  res.json({ sessionId });
});

const generateChatResponse = async (
  message,
  chatHistory,
  uploadedFileContent
) => {
  const messages = chatHistory.flatMap((entry) => [
    { role: "user", content: entry.message },
    { role: "system", content: entry.response },
  ]);

  if (uploadedFileContent) {
    messages.push({ role: "system", content: uploadedFileContent });
  }

  messages.push({ role: "user", content: message });

  try {
    const response = await openai.chat.completions({
      model: "text-davinci-002",
      messages,
      temperature: 0.5,
      max_tokens: 150,
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error calling OpenAI API", error);
    throw new Error("Failed to generate chat response");
  }
};

app.post("/chat", async (req, res) => {
  const { message, sessionId } = req.body;
  const session = sessions[sessionId];

  if (!session) {
    return res.status(404).send("Session not found");
  }

  try {
    const response = await generateChatResponse(
      message,
      session.chatHistory,
      session.uploadedFileContent
    );
    session.chatHistory.push({ message, response });
    res.json({ response });
  } catch (error) {
    res.status(500).send("Error processing chat message");
  }
});

app.post("/upload", (req, res) => {
  const { sessionId } = req.body;
  const session = sessions[sessionId];

  if (!session) {
    return res.status(404).send("Session not found");
  }

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  const userFile = req.files.file;
  const fileContent = userFile.data.toString("utf8");

  session.uploadedFileContent = fileContent;
  res.send("File uploaded!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
