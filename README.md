# 🌙 Namaz Vakti — ScriptWidget

macOS / iOS için [ScriptWidget](https://apps.apple.com/app/scriptwidget/id1555600758) üzerinde çalışan, bulunduğun konuma göre namaz vakitlerini gösteren sade bir widget. Konumu otomatik algılar, Diyanet hesaplama yöntemini kullanır ve günde yalnızca **bir kez** internete çıkar.

## Özellikler

- **Otomatik konum** — cihazın konum servisleri (`$location` / CoreLocation) ile bulunduğun yeri algılar.
- **Diyanet yöntemi** — vakitler [Aladhan API](https://aladhan.com/prayer-times-api) `method=13` (Diyanet İşleri Başkanlığı) ile hesaplanır.
- **Şu anki vakit + kalan süre** — örn. `İkindi · 2sa 41dk`.
- **Günde 1 ağ isteği** — veriler `$storage` ile önbelleğe alınır; gün değişene kadar tekrar internete çıkılmaz, ertesi gün otomatik yenilenir.
- **Kerahat uyarısı** — kerahat vakitlerinde `⚠️` işareti.

## Kurulum

1. App Store'dan **ScriptWidget** uygulamasını indir.
2. Uygulamada yeni bir script oluştur ve [`namaz-vakti-mac.jsx`](namaz-vakti-mac.jsx) dosyasının içeriğini yapıştır.
3. **Konum iznini ver:**
   - macOS: Sistem Ayarları → Gizlilik ve Güvenlik → Konum Servisleri → ScriptWidget → açık.
   - iOS: Ayarlar → ScriptWidget → Konum → "Uygulamayı Kullanırken".
4. Ana ekrana / masaüstüne ScriptWidget widget'ı ekle ve bu script'i seç.

> Konum izni verilmezse, dosyadaki yedek konum (`FALLBACK`) kullanılır.

## Özelleştirme

Dosyanın en üstündeki ayarlardan değiştirebilirsin:

- `FALLBACK` — konum alınamazsa kullanılacak yedek koordinat ve şehir. Varsayılan: Karlsruhe.
- `METHOD` — hesaplama yöntemi. `13` = Diyanet. Diğer yöntemler için Aladhan dokümanına bakabilirsin.

## Nasıl çalışır?

1. `$location` ile koordinat alınır (şehir seviyesi doğruluk yeterli).
2. [BigDataCloud](https://www.bigdatacloud.com/) reverse-geocode ile koordinattan şehir adı bulunur (yalnızca başlıkta göstermek için).
3. Aladhan API'den o günün vakitleri çekilir.
4. Sonuç `$storage`'a o günün tarihiyle yazılır. Widget tekrar çalıştığında aynı güne ait veri varsa internete çıkılmaz; sadece kalan süre yerelde yeniden hesaplanır.

## Notlar

- Üstteki saat ve kalan süre, widget en son ne zaman yenilendiyse o anı gösterir. iOS/macOS widget'ları saniye saniye güncellenmez; sistem kendi zaman çizelgesine göre arada bir yeniler, bu yüzden birkaç dakikalık gecikme normaldir.
- Kullanılan API'lerin hiçbiri anahtar (API key) gerektirmez ve ücretsizdir.

## Lisans

[MIT](LICENSE)
