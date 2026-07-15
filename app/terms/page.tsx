import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Điều khoản sử dụng — PaceLingo" };

export default function TermsPage() {
  return <LegalPage title="Điều khoản sử dụng" updatedAt="14/07/2026">
    <section><h2>Phạm vi dịch vụ</h2><p>PaceLingo cung cấp công cụ luyện tập và mô phỏng thi. Kết quả trên nền tảng chỉ mang tính tham khảo, không phải chứng chỉ hoặc điểm TOEIC chính thức.</p></section>
    <section><h2>Tài khoản</h2><p>Bạn chịu trách nhiệm bảo vệ tài khoản Google dùng để đăng nhập và không được chia sẻ quyền truy cập, khai thác lỗi hoặc gây gián đoạn hệ thống.</p></section>
    <section><h2>Nội dung và bản quyền</h2><p>Không được sao chép, phân phối hoặc khai thác thương mại nội dung trên PaceLingo khi chưa có sự cho phép. Hãy dùng tính năng báo lỗi nếu phát hiện nội dung có vấn đề.</p></section>
    <section><h2>Giới hạn trách nhiệm</h2><p>Dịch vụ có thể thay đổi hoặc tạm ngưng để bảo trì. PaceLingo không cam kết kết quả luyện tập sẽ tương đương tuyệt đối với kỳ thi thực tế.</p></section>
    <section><h2>Tuyên bố độc lập</h2><p>PaceLingo không liên kết, được tài trợ hay chứng thực bởi ETS hoặc IIG Việt Nam. TOEIC là nhãn hiệu của Educational Testing Service (ETS).</p></section>
    <section><h2>Thay đổi điều khoản</h2><p>Điều khoản có thể được cập nhật khi sản phẩm thay đổi. Ngày cập nhật mới nhất luôn được hiển thị ở đầu trang.</p></section>
  </LegalPage>;
}
