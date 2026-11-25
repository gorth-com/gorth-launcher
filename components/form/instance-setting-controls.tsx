import { useId, type ReactNode } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@gorth-com/primitive/default/card";
import { Field, FieldLabel } from "@gorth-com/primitive/default/field";
import { Switch } from "@gorth-com/primitive/default/switch";
import { Separator } from "@gorth-com/primitive/default/separator";
import { Input } from "@gorth-com/primitive/default/input";

export function OverrideCard({
  title,
  checked,
  onChange,
  description,
  unsupported,
  children,
}: {
  title: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  description?: string;
  unsupported?: boolean;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>
            <label htmlFor={id}>{title}</label>
          </CardTitle>
          <CardDescription>
            {description ??
              (checked
                ? "Cấu hình riêng cho instance này."
                : "Đang kế thừa cài đặt global.")}
          </CardDescription>
        </div>
        <Switch
          id={id}
          checked={checked}
          disabled={unsupported}
          onCheckedChange={onChange}
        />
      </CardHeader>
      {children && (
        <>
          <Separator />
          <CardContent className="p-4">
            <fieldset
              disabled={!checked || unsupported}
              className="flex min-w-0 flex-col gap-6 disabled:opacity-50"
            >
              {children}
            </fieldset>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export function SettingToggle({
  title,
  checked,
  onChange,
}: {
  title: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal" className="justify-between gap-4">
      <FieldLabel htmlFor={id}>{title}</FieldLabel>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  );
}

export function SettingInput({
  title,
  value,
  onChange,
  type = "text",
  min,
  max,
  placeholder,
  readOnly,
}: {
  title: string;
  value: string | number;
  onChange?: (value: string) => void;
  type?: "text" | "number";
  min?: number;
  max?: number;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const id = useId();
  return (
    <Field className="gap-1">
      <FieldLabel htmlFor={id}>{title}</FieldLabel>
      <Input
        id={id}
        type={type}
        min={min}
        max={max}
        step={type === "number" ? 1 : undefined}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </Field>
  );
}
