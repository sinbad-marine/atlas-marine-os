# Sinbad Bridge v0.2

Sinbad Bridge artık iki işi yapar:

1. Atlas Marine OS ile OpenCPN arasında, lisanslı harita verisine dokunmadan GPX rota ve waypoint alışverişi.
2. İnternet olmadığında ASUS üzerindeki Ollama modelini Sinbad'ın yerel AI beyni olarak kullanma.

## Klasörler

- Rotalar: `Belgeler\Sinbad Bridge\Routes`
- Yerel kütüphane: `Belgeler\Sinbad Bridge\Library`

Yerel kütüphane ilk sürümde `.txt`, `.md`, `.csv` ve `.json` dosyalarını tarar. PDF/DOCX dönüştürme ve bulut senkronizasyonu sonraki aşamada eklenecektir.

## Çalıştırma

1. Ollama ve `qwen3:14b` modeli kurulu olmalıdır.
2. `start-sinbad-bridge.cmd` dosyasına çift tıklayın veya otomatik başlatmayı kullanın.
3. `Sinbad Bridge is online` mesajından sonra web uygulamasını açın.

Bridge yalnızca `127.0.0.1:31983` üzerinde dinler; yerel ağdan veya internetten erişime açılmaz. o-charts/ENC dosyalarını okumaz, kopyalamaz veya sunucuya yüklemez.

Sinbad planlama ve karar desteğidir; sertifikalı ECDIS veya kaptanın yerine geçmez. Kodlama modu da sahibinin açık onayı olmadan canlı yayın, silme, ödeme veya kimlik bilgisi değişikliği yapmaz.

## Yerel XTTS-v2 ses klonu

Bridge, yalnız `127.0.0.1` üzerinde çalışan `/ai/tts` endpointiyle yerel XTTS-v2 ses klonunu kullanır. Varsayılan kurulum şu server-side dosyaları arar:

- `%USERPROFILE%\xtts_v2_model`
- `%USERPROFILE%\xtts_v2_model\config.json`
- `%USERPROFILE%\yasemin_sesi.wav`
- `%USERPROFILE%\AppData\Local\Programs\Python\Python311\python.exe`

Sinbad'a özel `%LOCALAPPDATA%\Sinbad\xtts-venv\Scripts\python.exe` mevcutsa Bridge önce bu izole ortamı kullanır; yoksa sistem Python'una döner.

Bridge açılırken `xtts-worker.py` yalnız `127.0.0.1:31984` üzerinde kalıcı olarak başlatılır. Model bir kez belleğe alınır; Yasemin referansının `gpt_cond_latent` ve `speaker_embedding` değerleri de bir kez hesaplanıp RAM'de tutulur. Referans WAV tarayıcıya verilmez, hiçbir ağ servisine yüklenmez ve yalnız sunucu tarafında okunur.

Web uygulaması uzun yanıtı en fazla 220 karakterlik cümle parçalarına ayırır. İlk parça oynarken sıradaki parça arka planda hazırlanır; yanıt metni de ilk klon ses hazır olduğunda gösterilir. Worker istek başına en fazla 240 karakter kabul eder ve aynı anda yalnız bir sentez çalıştırır. XTTS hazır değilse veya hata verirse güvenli biçimde sessiz kalır; tarayıcının standart sesine geri dönmez.

İlk Bridge açılışında model ve ses profili yüklenirken bekleme olur. Sonraki cümleler kalıcı model ve önbellekteki Yasemin profiliyle üretilir. Mevcut PyTorch kurulumu CPU tabanlı olduğundan gerçek gecikme donanıma ve cümle uzunluğuna bağlıdır; arayüz bu sırada hazırlık durumunu gösterir.
