import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Chính sách quyền riêng tư — PaceLingo" };

export default function PrivacyPage() {
  return <LegalPage title="Chính sách quyền riêng tư" updatedAt="14/07/2026">
    <section><h2>Thông tin chúng tôi thu thập</h2><p>PaceLingo lưu thông tin tài khoản Google cơ bản gồm email, tên và ảnh đại diện; đáp án, thời gian làm bài, lịch sử thi và phản hồi do bạn gửi.</p></section>
    <section><h2>Mục đích sử dụng</h2><p>Dữ liệu được dùng để đăng nhập, tự lưu bài, chấm điểm, tạo review, theo dõi tiến bộ, bảo vệ hệ thống và cải thiện trải nghiệm.</p></section>
    <section><h2>Cookie và phiên đăng nhập</h2><p>Refresh token được lưu trong cookie HttpOnly, Secure ở production và không thể được JavaScript phía trình duyệt đọc trực tiếp.</p></section>
    <section><h2>Lưu trữ và chia sẻ</h2><p>Dữ liệu ứng dụng được lưu trong PostgreSQL; ảnh, audio và snapshot đề được lưu trên object storage. PaceLingo không bán dữ liệu cá nhân cho bên thứ ba.</p></section>
    <section><h2>Quyền của bạn</h2><p>Bạn có thể yêu cầu xem, chỉnh sửa hoặc xóa dữ liệu cá nhân qua trang Liên hệ. Một số dữ liệu có thể được giữ lại khi pháp luật yêu cầu hoặc để phòng chống lạm dụng.</p></section>
    <section><h2>Bảo mật</h2><p>Hệ thống sử dụng HTTPS trong production, phân quyền, token có thời hạn, rate limit và kiểm tra quyền sở hữu dữ liệu. Không hệ thống nào có thể đảm bảo an toàn tuyệt đối.</p></section>
  </LegalPage>;
}
