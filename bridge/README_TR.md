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
- `%USERPROFILE%\AppData\Local\Programs\Python\Python311\Scripts\tts.exe`

Tarayıcı referans ses yolu gönderemez ve referans ses hiçbir ağ servisine yüklenmez. Aynı anda yalnız bir sentez çalışır, metin 800 karakterle sınırlıdır ve geçici WAV yanıt okunduktan sonra silinir. XTTS kullanılamazsa uygulama otomatik olarak tarayıcı sesine döner. CPU üzerinde ilk yanıt yaklaşık 12–15 saniye sürebilir.
