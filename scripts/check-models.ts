import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

interface Model {
  name: string;
  baseModelId?: string;
  version?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

interface ListModelsResponse {
  models?: Model[];
  nextPageToken?: string;
}

async function checkModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is not set in environment variables");
    console.error("   Please ensure .env.local exists and contains GEMINI_API_KEY");
    process.exit(1);
  }

  console.log("🔍 Fetching available models from Google Generative AI...\n");

  try {
    // Use REST API to list models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data: ListModelsResponse = await response.json();
    const allModels = data.models || [];
    
    // Filter models that support generateContent
    const generateContentModels = allModels.filter((model) => {
      return model.supportedGenerationMethods?.includes("generateContent");
    });

    console.log(`✅ Found ${generateContentModels.length} model(s) that support generateContent:\n`);
    
    if (generateContentModels.length === 0) {
      console.log("⚠️  No models found that support generateContent");
      return;
    }

    // Print model names (extract just the model name from "models/gemini-3-flash-preview" format)
    generateContentModels.forEach((model, index) => {
      const modelName = model.name.replace("models/", "");
      console.log(`${index + 1}. ${modelName}`);
      
      // Show additional info if available
      if (model.displayName) {
        console.log(`   Display Name: ${model.displayName}`);
      }
      if (model.description) {
        console.log(`   Description: ${model.description}`);
      }
      if (model.supportedGenerationMethods) {
        console.log(`   Supported Methods: ${model.supportedGenerationMethods.join(", ")}`);
      }
      if (model.inputTokenLimit) {
        console.log(`   Input Token Limit: ${model.inputTokenLimit.toLocaleString()}`);
      }
      if (model.outputTokenLimit) {
        console.log(`   Output Token Limit: ${model.outputTokenLimit.toLocaleString()}`);
      }
      console.log();
    });

    // Highlight models we're currently using
    console.log("📌 Currently used models:");
    console.log("   - gemini-3-flash-preview (primary)");
    console.log("   - gemini-1.5-pro (fallback)");
    
  } catch (error) {
    console.error("❌ Error fetching models:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
    }
    process.exit(1);
  }
}

checkModels();
