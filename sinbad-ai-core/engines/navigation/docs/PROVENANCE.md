# Provenans Kaydı

## Başlangıç snapshot'ı

| Öğe | Kaynak | SHA-256 / açıklama |
|---|---|---|
| Navigation implementation | `atlas_core_audit_2e_full/sinbad-navigation.js` | `007EB23C7513300E2C` ile başlayan SHA-256; bağımsız kopya ile tam eşleşme doğrulandı |
| Navigation tests | `atlas_core_audit_2e_full/tests/sinbad-navigation.test.js` | Yeni dizin yoluna göre yalnızca `require` satırı değiştirildi |
| Route data | `atlas_core_audit_2e_full/route-data.js` | Değiştirilmeden kopyalandı |

Kaynak klasör Git reposu değildir. Bu nedenle geçmiş commit kimliği veya upstream remote doğrulanamamıştır. Lisans/provenans netleşene kadar dış dağıtım yapılmamalıdır.

## WGS84 doğrulama referansı

WGS84 ters jeodezi doğrulama tabanı, resmi GeographicLib API dokümantasyonundaki Wellington–Salamanca örneğini kullanır: `s12=19959679.26735382 m`, `azi1=161.06766998615882°`, `azi2=18.825195123248392°`. Kaynak: https://geographiclib.sourceforge.io/html/python/code.html
