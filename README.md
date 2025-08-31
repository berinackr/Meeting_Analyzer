# Meeting Analyzer

Toplantı ses kayıtlarını analiz eden, konuşmacı ayrımı, cinsiyet tahmini, konuşma/sessizlik oranı ve otomatik transcript çıkaran bir uygulama.

## Proje Amacı ve Motivasyon

Toplantılarda sıkça yaşanan sorunlar:
- Bazı kişilerin konuşmaları domine etmesi  
- Katılımcılar arasında söz hakkı eşitsizliği  
- Toplantı verimliliğinin ölçülememesi  

**Meeting Analyzer**, bu sorunlara veri odaklı bir çözüm sunar:  
✔ Katılımın eşitliğini analiz eder  
✔ Kapsayıcı toplantı kültürünü destekler  
✔ Verimlilik raporları sağlar  

## Özellikler

- .wav dosyası yükleyerek toplantı analizi
- Konuşmacı ayrımı ve cinsiyet tahmini
- Konuşma/sessizlik oranı
- Otomatik transcript ve sohbet akışı
- Analiz sonuçlarını PDF olarak indirme

## ⚙ Teknik Mimari ve Çalışma Prensibi

Meeting Analyzer, **Flask backend** ve **React frontend** ile çalışır.

### **Pipeline:**
1. **Ses Dosyası Yükleme**  
2. **Speaker Diarization:** PyAnnote ile konuşmacı ayrımı  
3. **Cinsiyet Tahmini:** XGBoost + Librosa feature extraction  
4. **Transcript:** Faster-Whisper modeli  
5. **İstatistik Hesaplama:**  
   - Konuşma / Sessizlik oranı  
   - Kadın / Erkek konuşma oranı  
6. **Çıktı:** JSON + PDF rapor  

---

### Cinsiyet Tahmini Modeli

- **Veri Seti:** [Kaggle Gender Recognition by Voice](https://www.kaggle.com/datasets/murtadhanajim/gender-recognition-by-voiceoriginal/data)  
- **Öznitelikler:**  
  - MFCC  
  - Chroma  
  - Mel Spectrogram  
  - Spectral Contrast  
  - Tonnetz ...
- **Model:** XGBoost  
- **Başarım:** %95+ doğruluk  
- **Kaydetme:** `joblib.dump(model, 'xgboost_gender_model.pkl')`
- Modeli eğittiğimiz kod dosyası proje içerisindedir :(https://github.com/berinackr/Meeting_Analyzer/blob/main/kaggle_gender.ipynb)

## Kurulum

### 1. Depoyu Klonlayın

```bash
git clone https://github.com/berinackr/Meeting_Analyzer.git
cd Meeting_Analyzer
```

### 2. Python Sanal Ortamı ve Backend Kurulumu

```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

python -m pip install --upgrade pip wheel setuptools
pip install flask flask-cors werkzeug pydub pyannote.audio torch numpy scikit-learn xgboost joblib faster-whisper soundfile
```

#### Ekstra: ffmpeg kurulumu (pydub için gereklidir)
- **Windows:** [ffmpeg.org/download.html](https://ffmpeg.org/download.html)
- **Mac:** `brew install ffmpeg`
- **Linux:** `sudo apt-get install ffmpeg`

#### Ekstra: libsndfile kurulumu (pyannote.audio için gerekebilir)
- **Mac:** `brew install libsndfile`
- **Linux:** `sudo apt-get install libsndfile1`

#### HuggingFace Token
- [HuggingFace](https://huggingface.co/) hesabı açıp bir Access Token alın.
- `.env` dosyasına veya terminale:
  ```
  HUGGINGFACE_TOKEN=hf_xxx...xxx
  ```
  ekleyin.
- Eğer kendiniz hesap açıp almak istemezseniz benim .env dosyamı buradan indirip kullanabilirsiniz. (https://drive.google.com/file/d/1xHoauNlVA249mSUTY5-xe2W5FtQZY5Pc/view?usp=sharing)

### 3. Model Dosyalarını Kontrol Edin

`src/` klasöründe `xgboost_gender_model.pkl` ve `scaler.pkl` dosyalarının olduğundan emin olun.

### 4. Backend’i Başlatın

```bash
cd src
python server.py
```

### 5. Frontend Kurulumu

```bash
cd ..
npm install
npm start
```

Uygulama `http://localhost:3000` adresinde açılır.

---

## Kullanım

1. Web arayüzünde ses dosyası yükleyin.
2. Analiz tamamlanınca sonuçlar ve sohbet akışı ekranda görünür.
3. "PDF Olarak İndir" ile analiz raporunu PDF olarak kaydedebilirsiniz.

---

## Sorunlar ve Çözümler

- **ffmpeg hatası:** ffmpeg sistemde kurulu ve PATH’e ekli olmalı.
- **HuggingFace Token hatası:** Token’ı doğru eklediğinizden emin olun.
- **Model dosyası bulunamadı:** `xgboost_gender_model.pkl` ve `scaler.pkl` dosyalarının `src/` klasöründe olduğundan emin olun.
- **Port çakışması:** 3000 (frontend) veya 5000 (backend) portları başka bir uygulama tarafından kullanılmamalı.

---
## Screenshots

<div style="display: flex; gap: 10px; justify-content: center;">
  <img src="secreenshots/home.png" alt="home" width="500" />
  <img src="secreenshots/analiz.png" alt="analiz" width="500" />
</div>

🎥 **Demo Video:** [Watch on YouTube](https://youtu.be/gqyuyLLWMAY)
