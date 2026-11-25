import { useFeedbackToast } from "@/hooks/use-feedback-toast";
import { useState } from "react";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-com/primitive/default/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@gorth-com/primitive/default/radio-group";
import { useAuth } from "@/hooks/use-auth";

export function LoginBrowserSettings() {
  const auth = useAuth();
  const selected = auth.auth?.loginBrowser ?? "default";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useFeedbackToast(error);
  async function select(browser: "default" | "gorth") {
    setSaving(true);
    setError("");
    try {
      const result = await window.electronAPI.auth.setLoginBrowser(browser);
      if (result.error) setError(result.error);
    } catch {
      setError("Không thể lưu trình duyệt đăng nhập.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card className="gap-4 p-5" aria-label="Trình duyệt đăng nhập">
      <div className="flex flex-col gap-1">
        <CardTitle>Trình duyệt đăng nhập</CardTitle>
        <CardDescription>
          Chọn nơi mở trang đăng nhập Gorth. Không thay đổi trình duyệt mặc định
          của hệ điều hành.
        </CardDescription>
      </div>
      <RadioGroup
        aria-label="Trình duyệt đăng nhập"
        value={selected}
        disabled={saving || auth.busy}
        className="flex flex-col gap-4"
        onValueChange={(value) => {
          if (value === "default" || value === "gorth") void select(value);
        }}
      >
        {(
          [
            { value: "default", label: "Default browser" },
            { value: "gorth", label: "Gorth Browser" },
          ] as const
        ).map(({ value, label }) => (
          <label key={value} className="flex items-center gap-3 text-sm">
            <RadioGroupItem value={value} />
            {label}
          </label>
        ))}
      </RadioGroup>
      <CardDescription>
        Gorth Browser cần được cài và đăng ký deep link; khi chạy dev cần khởi
        động Browser trước. Nếu không mở được, chọn Default browser để thử lại.
      </CardDescription>
    </Card>
  );
}
