# 🌙 Namaz Vakti — ScriptWidget

macOS / iOS için [ScriptWidget](https://apps.apple.com/app/scriptwidget/id1555600758) üzerinde çalışan, bulunduğun konuma göre namaz vakitlerini gösteren sade bir widget. Konumu otomatik algılar, Diyanet hesaplama yöntemini kullanır ve aynı konumda kaldıkça günde yalnızca **bir kez** internete çıkar.

![Önizleme](preview.png)
<!-- İstersen widget'ın bir ekran görüntüsünü preview.png adıyla repoya ekleyebilirsin; eklemezsen bu satırı silebilirsin. -->

## Özellikler

- **Otomatik konum:** cihazın konum servisleri (`$location` / CoreLocation) ile bulunduğun yeri algılar. Konum alınamazsa IP üzerinden yaklaşık konum kullanılır.
- **Diyanet yöntemi:** vakitler [Aladhan API](https://aladhan.com/prayer-times-api) `method=13` (Diyanet İşleri Başkanlığı) ile hesaplanır.
- **Şu anki vakit + kalan süre:** örn. `İkindi · 2sa 41dk`.
- **Her zeminde okunur renkler:** vurgular mavi, kalan metin gri tonlarında. Açık ve koyu modda, iPhone'da ve Mac masaüstünde aynı şekilde okunur.
- **Az ağ isteği:** veriler `$storage` ile önbelleğe alınır. Aynı gün içinde ve aynı konumda tekrar internete çıkılmaz. Gün değişince veya konum yaklaşık 20 km'den fazla değişince vakitler otomatik yenilenir.
- **Kerahat uyarısı:** kerahat vakitlerinde `⚠️` işareti.

## Kurulum

1. App Store'dan **ScriptWidget** uygulamasını indir.
2. Uygulamada yeni bir script oluştur ve [`namaz-vakti.js`](namaz-vakti.js) dosyasının içeriğini yapıştır.
3. **Konum iznini ver (iOS):**
   - Script'i bir kez ScriptWidget uygulamasının içinde çalıştır, çıkan konum iznini "Uygulamayı Kullanırken" olarak onayla.
   - macOS'ta ScriptWidget konum servislerini desteklemiyor ("Location services are not available on this platform"). Mac'te widget IP üzerinden yaklaşık konum kullanır, istersen `SABIT_KONUM` ayarıyla şehri sabitleyebilirsin.
4. Ana ekrana / masaüstüne ScriptWidget widget'ı ekle ve bu script'i seç.

> Konum izni verilmezse widget IP üzerinden yaklaşık konumu kullanır. O da alınamazsa dosyadaki yedek konum (`FALLBACK`) devreye girer.

## Özelleştirme

Dosyanın en üstündeki ayarlardan değiştirebilirsin:

- `SABIT_KONUM`: konumu elle sabitlemek için, ör. `{ lat: 41.0082, lon: 28.9784, city: "İstanbul" }`. Doluysa konum izni ve IP konumu hiç kullanılmaz. Varsayılan: `null` (otomatik konum).
- `FALLBACK`: hiçbir konum kaynağı çalışmazsa kullanılacak yedek koordinat ve şehir. Varsayılan: Karlsruhe.
- `METHOD`: hesaplama yöntemi. `13` = Diyanet. Diğer yöntemler için Aladhan dokümanına bakabilirsin.

## Nasıl çalışır?

1. `$location` ile koordinat alınır (şehir seviyesi doğruluk yeterli). Alınamazsa [ipwho.is](https://ipwho.is) üzerinden yaklaşık IP konumu, o da olmazsa önbellekteki son konum ve `FALLBACK` denenir.
2. [BigDataCloud](https://www.bigdatacloud.com/) reverse-geocode ile koordinattan şehir adı bulunur (yalnızca başlıkta göstermek için).
3. Aladhan API'den o günün vakitleri çekilir.
4. Sonuç `$storage`'a o günün tarihi ve konumuyla yazılır. Widget tekrar çalıştığında aynı güne ve aşağı yukarı aynı konuma ait veri varsa internete çıkılmaz, sadece kalan süre yerelde yeniden hesaplanır.

## Notlar

- Üstteki saat ve kalan süre, widget en son ne zaman yenilendiyse o anı gösterir. iOS/macOS widget'ları saniye saniye güncellenmez; sistem kendi zaman çizelgesine göre arada bir yeniler, bu yüzden birkaç dakikalık gecikme normaldir.
- Kullanılan API'lerin hiçbiri anahtar (API key) gerektirmez ve ücretsizdir.

## Lisans

[MIT](LICENSE)
