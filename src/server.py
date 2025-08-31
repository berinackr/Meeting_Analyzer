from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from werkzeug.utils import secure_filename
from uuid import uuid4
import contextlib
import wave
from pydub import AudioSegment, effects
import logging
from pyannote.audio import Pipeline
from faster_whisper import WhisperModel
import numpy as np
import librosa
import joblib
import torch

# ================== LOGGING ==================
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# ================== AYARLAR ==================
ALLOWED_EXTENSIONS = {"wav"}
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
MAX_CLIP_DURATION = 3.0      # saniye
NUM_CLIPS_PER_SPK = 3        # her konuşmacıdan alınacak en net segment sayısı
MIN_CLIP_DURATION = 0.5      # çok kısa segmentleri at

# Flask
app = Flask(__name__)
CORS(app)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# ================== MODELLER ==================
HUGGINGFACE_TOKEN = os.getenv("HUGGINGFACE_TOKEN")
logging.info("PyAnnote pipeline yükleniyor...")
pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization@2.1", use_auth_token=HUGGINGFACE_TOKEN)
logging.info("PyAnnote pipeline yüklendi.")

MODEL_PATH = "xgboost_gender_model.pkl"
SCALER_PATH = "scaler.pkl"
model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)
logging.info("XGBoost model ve scaler yüklendi.")

# Whisper/Faster-Whisper modeli (CPU uyumlu)
device = "cuda" if torch.cuda.is_available() else "cpu"
logging.info("Faster-Whisper modeli yükleniyor...")
whisper_model = WhisperModel("small", device=device, compute_type="int8" if device == "cpu" else None)
logging.info("Faster-Whisper modeli yüklendi.")

# ================== HELPERS ==================
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def get_audio_duration(file_path):
    with contextlib.closing(wave.open(file_path, 'rb')) as wf:
        frames = wf.getnframes()
        rate = wf.getframerate()
        return frames / float(rate)

def extract_features(file_path, duration=3):
    try:
        y, sr = librosa.load(file_path, duration=duration, sr=None)
        y_trimmed, _ = librosa.effects.trim(y)
        mfccs = np.mean(librosa.feature.mfcc(y=y_trimmed, sr=sr, n_mfcc=20).T, axis=0)
        chroma = np.mean(librosa.feature.chroma_stft(y=y_trimmed, sr=sr).T, axis=0)
        mel = np.mean(librosa.feature.melspectrogram(y=y_trimmed, sr=sr).T, axis=0)
        contrast = np.mean(librosa.feature.spectral_contrast(y=y_trimmed, sr=sr).T, axis=0)
        tonnetz = np.mean(librosa.feature.tonnetz(y=librosa.effects.harmonic(y_trimmed), sr=sr).T, axis=0)
        features = np.hstack([mfccs, chroma, mel, contrast, tonnetz])
        return features
    except Exception as e:
        logging.warning(f"Feature extraction error: {e}")
        return None

def predict_gender_clip(audio_segment):
    if len(audio_segment) / 1000 < MIN_CLIP_DURATION:
        return "unknown"
    audio_segment = effects.normalize(audio_segment).set_channels(1).set_frame_rate(16000)
    tmp_path = f"tmp_{uuid4().hex}.wav"
    audio_segment.export(tmp_path, format="wav")
    features = extract_features(tmp_path)
    os.remove(tmp_path)
    if features is not None:
        features_scaled = scaler.transform([features])
        pred = model.predict(features_scaled)[0]
        return "male" if pred == 1 else "female"
    return "unknown"

def select_top_segments(segments, num_top=NUM_CLIPS_PER_SPK):
    sorted_segs = sorted(segments, key=lambda x: x[1] - x[0], reverse=True)
    return sorted_segs[:num_top]

def merge_segments(segments):
    if not segments:
        return []
    segments = sorted(segments, key=lambda x: x[0])
    merged = [segments[0]]
    for current in segments[1:]:
        last = merged[-1]
        if current[0] <= last[1]:
            merged[-1] = (last[0], max(last[1], current[1]))
        else:
            merged.append(current)
    return merged

# ================== API ==================
@app.route("/upload", methods=["POST"])
def upload_file():
    try:
        if "audio" not in request.files:
            return jsonify({"error": "Dosya bulunamadı (form alanı 'audio')"}), 400
        file = request.files["audio"]
        if file.filename == "" or not allowed_file(file.filename):
            return jsonify({"error": "Geçersiz dosya"}), 400

        filename = secure_filename(file.filename)
        unique_name = f"{uuid4().hex}_{filename}"
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
        file.save(save_path)
        logging.info(f"Dosya kaydedildi: {save_path}")

        duration = get_audio_duration(save_path)
        diarization = pipeline(save_path)
        speakers = {}
        all_segments = []
        full_audio = AudioSegment.from_wav(save_path).set_channels(1)

        # Konuşmacıları ve segmentlerini tespit et
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            if speaker not in speakers:
                speakers[speaker] = {"segments": [], "duration": 0.0, "transcripts": []}
            speakers[speaker]["segments"].append((turn.start, turn.end))
            speakers[speaker]["duration"] += float(turn.end - turn.start)
            all_segments.append((turn.start, turn.end))

        merged_segments = merge_segments(all_segments)
        total_speech_time = sum(seg[1] - seg[0] for seg in merged_segments)
        total_silence_time = duration - total_speech_time

        # Whisper ile transcript + konuşmacıya atama
        whisper_segments, _ = whisper_model.transcribe(save_path, vad_filter=True)

        full_transcript = []
        for seg in whisper_segments:
            start, end, text = seg.start, seg.end, seg.text.strip()
            assigned_speaker = None
            max_overlap = 0

            # En çok örtüşen konuşmacıyı bul
            for spk_id, spk_data in speakers.items():
                for s_start, s_end in spk_data["segments"]:
                    overlap = min(end, s_end) - max(start, s_start)
                    if overlap > 0.1 and overlap > max_overlap:  # tolerans 0.2 sn
                        max_overlap = overlap
                        assigned_speaker = spk_id

            if assigned_speaker:
                speakers[assigned_speaker]["transcripts"].append(f"{start:.2f}-{end:.2f}: {text}")
                full_transcript.append(f"{assigned_speaker}: {text}")
            else:
                full_transcript.append(f"UNKNOWN: {text}")

        response_speakers = []
        male_total = 0.0
        female_total = 0.0

        # Cinsiyet tahmini
        for spk_id, spk_data in speakers.items():
            top_segments = select_top_segments(spk_data["segments"], NUM_CLIPS_PER_SPK)
            votes = {"male": 0, "female": 0, "unknown": 0}
            for seg_start, seg_end in top_segments:
                clip = full_audio[int(seg_start * 1000):int(seg_end * 1000)]
                label = predict_gender_clip(clip)
                votes[label] += 1

            final_gender = max(votes, key=votes.get)
            if final_gender == "male":
                male_total += spk_data["duration"]
            elif final_gender == "female":
                female_total += spk_data["duration"]

            spk_data["gender"] = final_gender
            response_speakers.append({
                "id": spk_id,
                "duration": round(spk_data["duration"], 2),
                "gender": final_gender,
                "segments": [f"{s[0]:.2f}-{s[1]:.2f}" for s in spk_data["segments"]],
                "transcripts": spk_data["transcripts"]
            })

        total_gender_dur = male_total + female_total
        gender_distribution = {
            "male": round(male_total / total_gender_dur * 100, 2) if total_gender_dur > 0 else 0,
            "female": round(female_total / total_gender_dur * 100, 2) if total_gender_dur > 0 else 0
        }

        num_male = sum(1 for s in response_speakers if s["gender"] == "male")
        num_female = sum(1 for s in response_speakers if s["gender"] == "female")
        total_participants = num_male + num_female
        participant_distribution = {
            "male": round(num_male / total_participants * 100, 2) if total_participants > 0 else 0,
            "female": round(num_female / total_participants * 100, 2) if total_participants > 0 else 0
        }

        response = {
            "message": "Dosya başarıyla işlendi",
            "filename": unique_name,
            "duration_seconds": round(duration, 2),
            "speech_seconds": round(total_speech_time, 2),
            "silence_seconds": round(total_silence_time, 2),
            "speech_ratio_percent": round((total_speech_time / duration) * 100, 2),
            "silence_ratio_percent": round((total_silence_time / duration) * 100, 2),
            "num_speakers": len(speakers),
            "speakers": response_speakers,
            "gender_distribution": gender_distribution,
            "participant_distribution": participant_distribution,
            "full_transcript": " ".join(full_transcript)
        }

        print(response)
        return jsonify(response)

    except Exception as e:
        logging.exception("Hata oluştu:")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
