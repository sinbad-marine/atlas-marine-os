"""Loopback-only persistent XTTS-v2 worker for Sinbad Bridge."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import numpy as np
import soundfile as sf


STATE_LOCK = threading.Lock()
SYNTH_LOCK = threading.Lock()
STATE: dict[str, object] = {
    "state": "starting",
    "ready": False,
    "busy": False,
    "error": None,
    "loadSeconds": None,
    "syntheses": 0,
}
MODEL = None
GPT_COND_LATENT = None
SPEAKER_EMBEDDING = None
ARGS = None


def update_state(**values: object) -> None:
    with STATE_LOCK:
        STATE.update(values)


def state_snapshot() -> dict[str, object]:
    with STATE_LOCK:
        return dict(STATE)


def load_model() -> None:
    global MODEL, GPT_COND_LATENT, SPEAKER_EMBEDDING
    started = time.perf_counter()
    try:
        update_state(state="loading-runtime")
        from TTS.tts.configs.xtts_config import XttsConfig
        from TTS.tts.models.xtts import Xtts

        update_state(state="loading-model")
        config = XttsConfig()
        config.load_json(str(ARGS.config_path))
        model = Xtts.init_from_config(config)
        model.load_checkpoint(config, checkpoint_dir=str(ARGS.model_path), eval=True)
        model.cpu()

        raw_config = json.loads(ARGS.config_path.read_text(encoding="utf-8"))
        update_state(state="loading-speaker")
        gpt_cond_latent, speaker_embedding = model.get_conditioning_latents(
            audio_path=[str(ARGS.speaker_wav)],
            max_ref_length=int(raw_config.get("max_ref_len", 30)),
            gpt_cond_len=int(raw_config.get("gpt_cond_len", 30)),
            gpt_cond_chunk_len=int(raw_config.get("gpt_cond_chunk_len", 4)),
            sound_norm_refs=bool(raw_config.get("sound_norm_refs", True)),
            load_sr=22050,
        )
        MODEL = model
        GPT_COND_LATENT = gpt_cond_latent
        SPEAKER_EMBEDDING = speaker_embedding
        digest = hashlib.sha256(ARGS.speaker_wav.read_bytes()).hexdigest()[:12]
        update_state(
            state="ready",
            ready=True,
            error=None,
            loadSeconds=round(time.perf_counter() - started, 2),
            speakerDigest=digest,
        )
    except Exception as error:  # pragma: no cover - exercised by live startup
        update_state(
            state="failed",
            ready=False,
            error=f"{type(error).__name__}: {error}"[:500],
            loadSeconds=round(time.perf_counter() - started, 2),
        )


def synthesize(text: str, language: str) -> tuple[bytes, float]:
    if not state_snapshot().get("ready"):
        raise RuntimeError("XTTS_WORKER_NOT_READY")
    started = time.perf_counter()
    with SYNTH_LOCK:
        update_state(busy=True, state="synthesizing")
        try:
            result = MODEL.inference(
                text=text,
                language=language,
                gpt_cond_latent=GPT_COND_LATENT,
                speaker_embedding=SPEAKER_EMBEDDING,
                enable_text_splitting=False,
                speed=1.0,
            )
            samples = np.asarray(result["wav"], dtype=np.float32)
            output = io.BytesIO()
            sf.write(output, samples, 24000, format="WAV", subtype="PCM_16")
            elapsed = round(time.perf_counter() - started, 2)
            snapshot = state_snapshot()
            update_state(
                busy=False,
                state="ready",
                syntheses=int(snapshot.get("syntheses", 0)) + 1,
                lastSynthesisSeconds=elapsed,
            )
            return output.getvalue(), elapsed
        except Exception:
            update_state(busy=False, state="ready")
            raise


class WorkerHandler(BaseHTTPRequestHandler):
    server_version = "SinbadXTTS/1.0"

    def log_message(self, _format: str, *_args: object) -> None:
        return

    def send_json(self, status: int, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.client_address[0] != "127.0.0.1" or self.path != "/status":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        self.send_json(HTTPStatus.OK, state_snapshot())

    def do_POST(self) -> None:  # noqa: N802
        if self.client_address[0] != "127.0.0.1" or self.path != "/synthesize":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 8192:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "invalid request size"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            text = str(payload.get("text", "")).strip()
            language = str(payload.get("language", "tr")).split("-")[0].lower()
            if not text or len(text) > 240:
                raise ValueError("text must contain 1-240 characters")
            if language not in {"tr", "en", "de", "fr", "es", "it"}:
                language = "tr"
            audio, elapsed = synthesize(text, language)
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("X-Sinbad-Synthesis-Seconds", str(elapsed))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(audio)
        except RuntimeError as error:
            self.send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": str(error), "status": state_snapshot()})
        except Exception as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": f"{type(error).__name__}: {error}"[:500]})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", type=Path, required=True)
    parser.add_argument("--config-path", type=Path, required=True)
    parser.add_argument("--speaker-wav", type=Path, required=True)
    parser.add_argument("--port", type=int, default=31984)
    return parser.parse_args()


def main() -> int:
    global ARGS
    ARGS = parse_args()
    for path in (ARGS.model_path, ARGS.config_path, ARGS.speaker_wav):
        if not path.exists():
            raise FileNotFoundError(path)
    threading.Thread(target=load_model, name="xtts-loader", daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", ARGS.port), WorkerHandler).serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
