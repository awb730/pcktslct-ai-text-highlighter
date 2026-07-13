from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

# CORS — this allows Chrome extension to talk to this server.
# Chrome extensions have a special origin (chrome-extension://...)
# so we allow all origins here. In production you could lock this down
# to just your extension's ID once you have it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Pydantic model — this defines the shape of the JSON body
# that the extension will send us. FastAPI validates it automatically.
class AskRequest(BaseModel):
    text: str          # the highlighted text
    mode: str = "explain"   # default mode; we'll add more later

class AskImageRequest(BaseModel):
    image_data: str
    mode: str = "explain"

# The system prompt changes based on what mode the user picked.
# Right now we have one mode, but this pattern makes it easy to add
# "summarize", "translate", "define" later.
def build_system_prompt(mode: str) -> str:
    prompts = {
        "explain": (
            "You are a helpful assistant embedded in a browser extension. "
            "The user has highlighted some text on a webpage and wants a clear, "
            "concise explanation of it. Be direct and informative. "
            "Keep your response to 2-4 sentences unless the topic requires more depth. "
            "Do not start with 'This text...' or repeat the highlighted text back."
        ),
        "summarize": (
            "You are a helpful assistant embedded in a browser extension. "
            "The user has selected content and wants a concise summary. "
            "Summarize the key points in 3-5 bullet points. Be brief and direct."
        ),
        "translate": (
            "You are a helpful assistant embedded in a browser extension. "
            "The user has selected content and wants it translated to English. "
            "Provide the translation only, without explanation or preamble."
        ),
        "simplify": (
            "You are a helpful assistant embedded in a browser extension. "
            "The user has selected content and wants it explained in simple terms. "
            "Use plain language as if explaining to a curious 12-year-old. Avoid jargon."
        ),
    }
    return prompts.get(mode, prompts["explain"])

@app.get("/")
def root():
    return {"message": "OpenAI API Running"}

@app.post("/ask")
async def ask(req: AskRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="No text provided")

    if len(req.text) > 5000:
        raise HTTPException(status_code=400, detail="Text too long (max 5000 chars)")

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": build_system_prompt(req.mode)},
                {"role": "user", "content": req.text}
            ],
            max_tokens=300,
            temperature=0.4,
        )
        return {"response": response.choices[0].message.content}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ask-image")
async def ask_image(req: AskImageRequest):
    if not req.image_data or not req.image_data.strip():
        raise HTTPException(status_code=400, detail="No image data provided")

    image_data = req.image_data.strip()
    # Extension may send a full data URL; OpenAI expects raw base64 in the url field.
    if image_data.startswith("data:"):
        image_data = image_data.split(",", 1)[-1]

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": build_system_prompt(req.mode)},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{image_data}"},
                        }
                    ],
                },
            ],
            max_tokens=300,
            temperature=0.4,
        )
        return {"response": response.choices[0].message.content}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Health check route — useful for Render and for testing
@app.get("/health")
def health():
    return {"status": "ok"}