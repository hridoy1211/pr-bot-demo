import { GoogleGenAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not set.");
  process.exit(1);
}

// এটি পুরোনো এবং নতুন সব ভার্সনে কাজ করে
const genAI = new GoogleGenAI(apiKey);

async function main() {
  try {
    const filePath = path.join(process.cwd(), 'src', 'main', 'java', 'com', 'demo', 'bank', 'Account.java');
    
    if (!fs.existsSync(filePath)) {
      console.log("Target file not found for review.");
      return;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');

    console.log("Sending code to Gemini for review...");
    
    // getGenerativeModel পদ্ধতিটি সবচেয়ে নিরাপদ
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const response = await model.generateContent(
      `You are a Senior Java Code Reviewer. Review the following code and point out bugs or logic issues briefly:\n\n${fileContent}`
    );

    console.log("\n=== Gemini Code Review Results ===");
    console.log(response.text);
    console.log("==================================\n");

  } catch (error) {
    console.error("Gemini API call failed:", error);
    process.exit(1);
  }
}

main();