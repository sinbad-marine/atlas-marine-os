# Sinbad Navigation Engine Core entegrasyonu

- Kaynak repo: `C:\Users\ASUS\Documents\Codex\2026-08-08\e\sinbad-navigation-engine`
- Kaynak commit: `ff7f3c52a884819ef6ccdd12903230a0eecdb7a1`
- Paket sürümü: `0.2.0`
- Core entegrasyon sözleşmesi: `core-navigation-engine-loader/1.0.0`

Motor `sinbad-ai-core/engines/navigation` altında bağımsız ve test edilebilir paket olarak bulunur. `adapters/installed-navigation-engine.js` tembel yükleyicidir; metadata okumak navigasyon matematiğini yüklemez. `adapters/navigation-engine-adapter.js` varsayılan olarak `EXECUTION_BLOCKED` döner.

Core orchestrator ve retrieval/grounding zinciri değiştirilmemiştir ve `PLAN_ONLY` kalır. Uygulama katmanı motoru yalnız süreli, kimlikli, açık operasyon allowlist'i taşıyan `AUTHORIZED_EXECUTION` kaydıyla çağırabilir. Bu kayıt klas/bayrak/ECDIS onayı değildir ve kaptan/OOW yetkisinin yerine geçmez.
