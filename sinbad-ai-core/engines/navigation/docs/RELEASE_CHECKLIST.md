# 0.2.0 mühendislik temeli kabul matrisi

| Gereksinim | Kanıt | Durum |
|---|---|---|
| Çalışan kod | `src/`, `examples/basic-route.js`, `npm run verify` | Sağlandı |
| WGS84 jeodezi | `src/wgs84-geodesy.js`, resmî fixture testi | Sağlandı |
| Açık Dünya modeli | `src/index.js`, `tests/navigation-api.test.js` | Sağlandı |
| Açık birimler | `src/quantities.js`, `tests/quantities.test.js` | Sağlandı |
| Koordinatlı rota | `src/route-plan.js`, `tests/route-plan.test.js` | Sağlandı |
| Değişiklik bütünlüğü | `src/route-revision.js`, zincir/tamper testleri | Sağlandı |
| Tolerans dışı güvenli durma | `src/calculation-verification.js` | Sağlandı |
| Girdi provenansı/güncelliği | `src/input-provenance.js` | Sağlandı |
| Bağımsız mevki çapraz kontrolü | `src/position-consensus.js` | Sağlandı |
| İnsan onaylı yayın kapısı | `src/route-release.js` | Sağlandı |
| API ve kullanım belgesi | `docs/API.md`, `README.md`, `examples/` | Sağlandı |
| Açık kapsam/sınırlar | `docs/SCOPE_AND_LIMITS.md` | Sağlandı |
| Tehdit ve artık risk kaydı | `docs/THREAT_MODEL.md` | Sağlandı |
| Provenans/lisans sınırı | `docs/PROVENANCE.md`, `THIRD_PARTY_NOTICES.md`, `private`, `UNLICENSED` | Sağlandı |
| Tekrarlanabilir teslim denetimi | `scripts/release-audit.js`, `npm run verify` | Sağlandı |
| Kontrollü paket içeriği | `package.json#files`, `.npmignore`, `npm pack --dry-run` | Sağlandı |
| Temiz Git çalışma ağacı | Son doğrulamada `git status --short` boş olmalıdır | Doğrulama kapısı |

Bu matris yalnız belgelenmiş `0.2.0` mühendislik temelinin kabulüdür. Operasyonel/sertifikalı ürün sınırları `SCOPE_AND_LIMITS.md` içinde ayrıca ve bağlayıcı biçimde belirtilmiştir.
