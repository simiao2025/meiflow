import os

from elevenlabs.client import AsyncElevenLabs
from openai import AsyncOpenAI

from app.config import settings

# Clients
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

# ElevenLabs requires API key from environment variable ELEVEN_API_KEY or explicit parameter
# We assume it's in settings.ELEVENLABS_API_KEY, falling back to OS env
eleven_key = getattr(settings, 'ELEVENLABS_API_KEY', os.getenv('ELEVENLABS_API_KEY', ''))
eleven_client = AsyncElevenLabs(api_key=eleven_key) if eleven_key else None

class AudioService:
    @staticmethod
    async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.ogg") -> str:
        """Transcreve áudio em bytes para texto usando OpenAI Whisper."""
        try:
            # Whisper requires a file-like object with a filename.
            # We save it temporarily
            temp_path = f"/tmp/{filename}" if os.name != 'nt' else f"temp_{filename}"
            with open(temp_path, "wb") as f:
                f.write(audio_bytes)

            with open(temp_path, "rb") as f:
                transcript = await openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=f,
                    language="pt"
                )

            # Clean up
            os.remove(temp_path)
            return transcript.text
        except Exception as e:
            print(f"Erro na transcrição de áudio: {e}")
            return ""

    @staticmethod
    async def generate_speech(text: str, voice_id: str = "ErXwobaYiN019PkySvjV") -> bytes:
        """Gera áudio a partir de texto usando ElevenLabs (Retorna bytes do áudio)."""
        if not eleven_client:
            print("ElevenLabs API Key não configurada.")
            return b""

        try:
            # Utilizando a versão turbo para latência menor no WhatsApp
            audio_generator = await eleven_client.generate(
                text=text,
                voice=voice_id,
                model="eleven_multilingual_v2"
            )

            # ElevenLabs async generate returns an AsyncGenerator of bytes
            audio_bytes = b""
            async for chunk in audio_generator:
                audio_bytes += chunk

            return audio_bytes
        except Exception as e:
            print(f"Erro ao gerar áudio com ElevenLabs: {e}")
            return b""
