# Chrome Bubble Dictionary

Extension Chrome tra từ vựng tiếng Anh ngay trên trang web: bôi đen một từ, chuột phải chọn **Tra từ**, một bong bóng nhỏ hiện ra với phiên âm, nghĩa tiếng Anh, nghĩa tiếng Việt và nút phát âm.

## Tính năng

- **Tra từ qua menu chuột phải** – không làm phiền khi bạn chỉ bôi đen để copy.
- **Phiên âm IPA** và **1–2 nghĩa tiếng Anh** ngắn gọn, kèm từ loại (noun, verb, …).
- **Nghĩa tiếng Việt** của từ và bản dịch tiếng Việt cho từng định nghĩa.
- **Phát âm** bằng file audio chuẩn (ưu tiên giọng US); nếu không có audio, tự động đọc bằng giọng của trình duyệt.
- **Mở trên Cambridge Dictionary** trong tab mới chỉ với một click.
- Tự đổi sang **giao diện tối** theo hệ điều hành.

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
5. Extension xuất hiện trong danh sách là đã cài xong.

> Dùng được trên các trình duyệt nhân Chromium khác như Edge, Brave, Cốc Cốc (trang quản lý extension tương ứng: `edge://extensions`, `brave://extensions`, …).

### Cập nhật phiên bản mới

```bash
cd chrome-bubble-dictionary
git pull
```

Sau đó vào `chrome://extensions` và bấm nút tải lại (↻) trên thẻ của extension.

## Cách dùng

1. Bôi đen (hoặc double-click) **một từ tiếng Anh** trên trang web bất kỳ.
2. Bấm **chuột phải** → chọn **Tra từ "…"**.
3. Bong bóng hiện ra tại vị trí con trỏ:

   ```
   run  /ɹʊn/                         🔊 📖
   ─────────────────────────────────────
   [VI] chạy
   [noun] A pleasure trip.
          Một chuyến đi thú vị.
   [verb] To move swiftly.
          Di chuyển nhanh chóng.
   ```

   - 🔊 **Phát âm** từ.
   - 📖 **Mở trên Cambridge** trong tab mới.
4. Click ra ngoài bong bóng hoặc nhấn `Esc` để đóng.

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
| Content script trên mọi trang | Hiển thị bong bóng trên bất kỳ trang web nào |

Extension không thu thập hay lưu trữ dữ liệu người dùng; chỉ từ bạn chọn tra mới được gửi tới các nguồn dữ liệu ở trên.

## Cấu trúc mã nguồn

```
├── manifest.json   # Cấu hình extension (Manifest V3)
├── background.js   # Service worker: tạo menu chuột phải, gửi từ cần tra tới trang
├── content.js      # Gọi API, dịch, phát âm, hiển thị bong bóng
└── content.css     # Giao diện bong bóng
```

Viết bằng Vanilla JavaScript, không dùng thư viện ngoài, không cần build.
