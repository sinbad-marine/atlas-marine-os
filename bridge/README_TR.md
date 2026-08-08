# Sinbad Bridge v0.1

Sinbad Bridge, Atlas Marine OS ile OpenCPN arasında lisanslı harita verisine dokunmadan GPX rota ve waypoint alışverişi yapar.

## Çalıştırma

1. `start-sinbad-bridge.cmd` dosyasına çift tıklayın.
2. Açılan pencereyi Sinbad kullanılırken açık bırakın.
3. Sinbad içindeki Passage Plan Studio bölümünde waypoint ekleyin.
4. **Send to local Bridge** düğmesine basın.
5. OpenCPN içinde Route & Mark Manager → Import GPX ile `Belgeler\Sinbad Bridge\Routes` klasöründeki rotayı açın.

Bridge yalnızca `127.0.0.1:31983` üzerinde dinler; yerel ağdan veya internetten erişime açılmaz. o-charts/ENC dosyalarını okumaz, kopyalamaz veya sunucuya yüklemez.

Bu özellik planlama ve karar desteği içindir; sertifikalı ECDIS değildir.
