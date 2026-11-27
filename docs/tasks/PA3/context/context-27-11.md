# Context PA#3 — 27/11/2026

## 1. Task T23 — `Changed` và `Rejected` trong AI-LOG của Thế Vinh (`@Thế Vinh` với Claude Code)

- Điền 2 dòng `Changed` và `Rejected` còn trống trong entry `2026-11-25 — Guardrails, checker command, 9router model and dev-set run (PA#3, Thế Vinh)` của `AI-LOG.md`. Nội dung do Thế Vinh duyệt trong chat trước khi ghi.
- `Changed`: đổi Gemini 3.6 sang `ag/gemini-3.8-flash` qua 9router và sửa docs; bỏ trailer `Co-Authored-By` trong commit; 2 lần trừ sai do hard rules bắt nhầm hàm `sort`/`gcd` tự viết, sửa sau khi có trap test; sửa lỗi verify JWT dùng đồng hồ thật thay vì đồng hồ được inject.
- `Rejected`: dán API key vào chat/terminal (key chỉ nằm trong `.env`); sửa lỗi bỏ sót `reverse-words/s05` (để cho người làm T11); sửa model mặc định trong migration đã chạy; giới hạn chi phí theo lab (provider miễn phí, $0).
- Ghi chú: hạn PA#3 đã được thầy dời sang Chủ nhật 29/11/2026, 22:00 (thông báo Classroom ngày 24/11); mục T26 trong checklist vẫn ghi 25/11.
