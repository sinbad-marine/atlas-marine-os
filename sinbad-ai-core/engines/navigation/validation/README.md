# Golden Validation

Bu dizin bağımsız otorite çıktıları ve beklenen sonuçlar içindir.

Her fixture şu alanları taşımalıdır:

- `case_id`
- `topic`
- `source_title`
- `source_url_or_reference`
- `source_date_or_edition`
- `inputs`
- `expected`
- `tolerance`
- `units`
- `sign_convention`
- `notes`

`geographiclib-wellington-salamanca.json`, resmî yayımlanmış WGS84 örneğini saklayan ilk otorite fixture'ıdır. Unit ve property testleri tek başına bağımsız doğruluk kanıtı değildir; yalnız kaynak kimliği, sürüm, beklenen değer ve tolerans taşıyan fixture'lar bu amaçla sayılır.
