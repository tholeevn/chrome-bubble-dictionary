# Chrome Bubble Dictionary

Extension Chrome tra từ vựng tiếng Anh ngay trên trang web: bôi đen một từ, chuột phải chọn **Tra từ**, một bong bóng nhỏ hiện ra với phiên âm, nghĩa tiếng Anh, nghĩa tiếng Việt và nút phát âm. Từ hay có thể lưu vào **sổ từ vựng** và xuất sang **Anki** để ôn tập.

## Tính năng

- **Tra từ qua menu chuột phải** (mặc định), hoặc **tự hiện khi bôi đen**, hoặc **bôi đen khi giữ Alt** – tuỳ chọn trong Cài đặt.
- **Phiên âm IPA** và **1–3 nghĩa tiếng Anh** ngắn gọn, kèm từ loại (noun, verb, …).
- **Nghĩa tiếng Việt** của từ và bản dịch tiếng Việt cho từng định nghĩa.
- **Phát âm** giọng **US hoặc UK** bằng file audio chuẩn; nếu không có audio, tự động đọc bằng giọng của trình duyệt.
- **Mở trên Cambridge Dictionary** trong tab mới chỉ với một click.
- **Sổ từ vựng**: bấm ⭐ để lưu từ kèm câu ví dụ và trang web nơi bạn gặp từ đó.
- **Lịch sử tra từ**: tự ghi lại các từ đã tra và số lần tra.
- **Xuất Anki** thành flashcard, **sao lưu / khôi phục** toàn bộ dữ liệu bằng file JSON.
- Giao diện **sáng / tối / theo hệ thống**.

## Cài đặt

Extension chưa có trên Chrome Web Store, cài thủ công như sau:

1. Tải mã nguồn về máy:
   ```bash
   git clone https://github.com/tholeevn/chrome-bubble-dictionary.git
   ```
   hoặc bấm **Code → Download ZIP** trên GitHub rồi giải nén.
2. Mở Chrome, truy cập `chrome://extensions`.
3. Bật **Developer mode** (góc trên bên phải).
4. Bấm **Load unpacked** và chọn thư mục `chrome-bubble-dictionary`.
5. Bấm biểu tượng 🧩 trên thanh công cụ và **ghim (📌) Vocab Bubble** để mở sổ từ nhanh hơn.

> Dùng được trên các trình duyệt nhân Chromium khác như Edge, Brave, Cốc Cốc (trang quản lý extension tương ứng: `edge://extensions`, `brave://extensions`, …).

### Cập nhật phiên bản mới

```bash
cd chrome-bubble-dictionary
git pull
```

Sau đó vào `chrome://extensions` và bấm nút tải lại (↻) trên thẻ của extension. Sổ từ, lịch sử và cài đặt được giữ nguyên.

## Cách dùng

### Tra từ

1. Bôi đen (hoặc double-click) **một từ tiếng Anh** trên trang web bất kỳ.
2. Bấm **chuột phải** → chọn **Tra từ "…"**.
3. Bong bóng hiện ra tại vị trí con trỏ:

   ```
   run  /ɹʊn/                      🔊 ⭐ 📖
   ─────────────────────────────────────
   [VI] chạy
   [noun] A pleasure trip.
          Một chuyến đi thú vị.
   [verb] To move swiftly.
          Di chuyển nhanh chóng.
   ```

   - 🔊 **Phát âm** từ.
   - ⭐ **Lưu vào sổ từ** (bấm lần nữa để bỏ lưu). Câu chứa từ trên trang được lưu kèm làm ví dụ.
   - 📖 **Mở trên Cambridge** trong tab mới.
4. Click ra ngoài bong bóng hoặc nhấn `Esc` để đóng.

### Sổ từ & lịch sử

- **Bấm icon extension** trên thanh công cụ để mở popup với hai tab **Sổ từ** và **Lịch sử**: tìm kiếm, nghe phát âm, bấm vào một từ để xem đầy đủ nghĩa và câu ví dụ.
- Trong tab **Lịch sử**, bấm ⭐ để lưu một từ đã tra vào sổ.
- Bấm ↗ trên popup để mở **trang quản lý** đầy đủ (hoặc chuột phải icon extension → **Options**): sắp xếp, xoá từ, xoá lịch sử, xuất/nhập file và cài đặt.

### Xuất sang Anki

1. Trong trang quản lý, tab **Sổ từ** → bấm **Xuất Anki**, được file `vocab-anki-YYYY-MM-DD.txt`.
2. Mở Anki → **File → Import** → chọn file vừa tải.
3. Chọn note type **Basic** và deck muốn nhập vào → **Import**.

Mỗi từ thành một flashcard: mặt trước là từ + phiên âm, mặt sau là nghĩa tiếng Việt, các định nghĩa (Anh + Việt), câu ví dụ và link trang nguồn. Các thẻ được gắn tag `vocab-bubble`.

### Sao lưu & khôi phục

- **Sao lưu JSON**: tải về toàn bộ sổ từ và lịch sử.
- **Khôi phục JSON**: chọn file sao lưu để nhập lại – dữ liệu được **gộp** với dữ liệu hiện có (không xoá từ nào), dùng để chuyển sang máy khác.

### Cài đặt

| Nhóm | Tuỳ chọn |
| --- | --- |
| Cách kích hoạt | Chỉ menu chuột phải · Tự hiện khi bôi đen · Bôi đen khi giữ Alt (⌥ trên Mac) |
| Giọng đọc | Anh – Mỹ (US) · Anh – Anh (UK) |
| Nội dung bong bóng | Bật/tắt nghĩa tiếng Việt · Bật/tắt dịch từng định nghĩa · Số nghĩa hiển thị (1–3) |
| Giao diện | Theo hệ thống · Sáng · Tối |
| Lịch sử | Bật/tắt ghi lịch sử · Giữ tối đa 100 / 500 / 1000 / 5000 mục |

Cài đặt được đồng bộ theo tài khoản Chrome; sổ từ và lịch sử lưu trên máy (dùng Sao lưu JSON để chuyển máy).

**Lưu ý:**

- Chỉ tra được **một từ** gồm toàn chữ cái (không khoảng trắng, không số). Nếu chọn cả cụm từ, bong bóng sẽ nhắc bạn chọn lại.
- Extension không hoạt động trên các trang hệ thống của Chrome (`chrome://…`) và Chrome Web Store – đây là giới hạn của Chrome.
- Một số trang chặn tải âm thanh từ bên ngoài; khi đó nút phát âm sẽ dùng giọng đọc của trình duyệt.

## Nguồn dữ liệu

| Dữ liệu | Nguồn |
| --- | --- |
| Nghĩa tiếng Anh, phiên âm, audio | [Free Dictionary API](https://dictionaryapi.dev/) |
| Nghĩa tiếng Việt | Google Translate (endpoint công khai, không cần API key) |
| Phát âm dự phòng | Web Speech API (`speechSynthesis`) của trình duyệt |
| Tra cứu chi tiết | [Cambridge Dictionary](https://dictionary.cambridge.org/) |

Endpoint Google Translate không phải API chính thức nên có thể bị giới hạn hoặc thay đổi; khi đó phần tiếng Anh vẫn hoạt động bình thường.

## Quyền truy cập

| Quyền | Lý do |
| --- | --- |
| `contextMenus` | Thêm mục **Tra từ** vào menu chuột phải |
| `activeTab`, `scripting` | Chạy extension trên tab đã mở trước khi cài/cập nhật mà không cần tải lại trang |
| `storage` | Lưu sổ từ, lịch sử và cài đặt |
| Content script trên mọi trang | Hiển thị bong bóng trên bất kỳ trang web nào |

Sổ từ và lịch sử chỉ nằm trong trình duyệt của bạn, không gửi đi đâu; chỉ từ bạn chọn tra mới được gửi tới các nguồn dữ liệu ở trên.

## Cấu trúc mã nguồn

```
├── manifest.json        # Cấu hình extension (Manifest V3)
├── background.js        # Service worker: menu chuột phải, gửi từ cần tra tới trang
├── content.js           # Bong bóng trên trang web: kích hoạt, hiển thị, lưu từ, ghi lịch sử
├── content.css          # Giao diện bong bóng
├── lib/
│   ├── store.js         # Lưu trữ: cài đặt, sổ từ, lịch sử (chrome.storage)
│   ├── dictionary.js    # Tra từ: Free Dictionary API + Google Translate
│   ├── audio.js         # Phát âm (audio US/UK, dự phòng speechSynthesis)
│   ├── ui.js            # Tiện ích DOM & icon dùng chung
│   └── export.js        # Xuất Anki, sao lưu/khôi phục JSON
└── pages/
    ├── popup.html       # Popup khi bấm icon extension
    ├── manager.html     # Trang quản lý: sổ từ, lịch sử, cài đặt
    ├── app.js           # Logic chung cho popup và trang quản lý
    └── app.css          # Giao diện popup và trang quản lý
```

Viết bằng Vanilla JavaScript, không dùng thư viện ngoài, không cần build.
