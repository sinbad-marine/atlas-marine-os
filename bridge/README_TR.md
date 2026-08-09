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
