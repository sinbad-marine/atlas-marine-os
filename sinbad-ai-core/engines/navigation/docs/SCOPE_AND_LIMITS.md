# Kapsam ve sınırlar

## Bu teslim nedir?

Test edilebilir bir deniz seyir matematiği mühendislik temelidir. WGS84 jeodezi, açık birimler, koordinatlı rota planı, revizyon bütünlüğü, referans tolerans kapısı, girdi provenansı, bağımsız mevki çapraz kontrolü ve insan onaylı yayın akışı sağlar.

## Bu teslim ne değildir?

- ECDIS, ECS, autopilot veya uzaktan gemi kumanda sistemi değildir.
- ENC/S-57/S-101 harita görüntüleyici veya rota tehlike tarayıcısı değildir.
- COLREG karar otoritesi değildir.
- Gerçek zamanlı GNSS/AIS/radar/sensör sürücüsü değildir.
- Gelgit, akıntı, meteoroloji, manyetik model veya astronomik efemeris veri servisi değildir.
- Bayrak, klas veya tip onaylı yükleme/seyir bilgisayarı değildir.
- Kaptanın, OOW’nin, onaylı yayınların ve köprüüstü prosedürlerinin yerine geçmez.

## Doğrulama kapsamı

WGS84 direct/inverse çekirdeği resmî GeographicLib örnekleri ve köşe testleriyle sınanmıştır. Eski küresel/seyir fonksiyonlarının geniş testi vardır; ancak tüm eski formüller için bağımsız otorite fixture kapsamı tamamlanmış değildir. Bu ayrım metadata ve API sınırlarında korunur.

## Operasyonel ürüne geçişte kalanlar

Tehlike/harita verisi entegrasyonu, hedef platform gereksinimleri, FMEA/hazard analysis, bağımsız V&V, siber güvenlik değerlendirmesi, insan faktörleri testi, donanım/sensör entegrasyonu, kayıt saklama politikası ve ilgili bayrak/klas/üretici onay süreçleri ayrıca yürütülmelidir.
