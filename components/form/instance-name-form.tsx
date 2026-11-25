import { useForm } from "@gorth-com/primitive/cores/tanstack/form";
import { Button } from "@gorth-com/primitive/custom/button";
import { Input } from "@gorth-com/primitive/default/input";

export function InstanceNameForm({
  initialName,
  busy,
  onSave,
  onCopy,
}: {
  initialName: string;
  busy: boolean;
  onSave: (name: string) => Promise<void>;
  onCopy: (name: string) => Promise<void>;
}) {
  const form = useForm({
    defaultValues: { name: initialName },
    onSubmit: async ({ value }) => {
      await onSave(value.name.trim());
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <form.Field name="name">
        {(field) => (
          <label className="flex flex-col gap-2">
            Tên instance
            <Input
              required
              maxLength={60}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </label>
        )}
      </form.Field>
      <div className="flex gap-2">
        <Button className="h-9" variant="outline" type="submit" disabled={busy}>
          Lưu tên
        </Button>
        <Button
          className="h-9"
          variant="outline"
          type="button"
          disabled={busy}
          onClick={() =>
            void onCopy(
              (form.state.values.name.trim().slice(0, 50) ||
                initialName.slice(0, 50)) + " (bản sao)",
            )
          }
        >
          Sao chép instance
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Bản sao có thư mục riêng, bao gồm world, mod và cấu hình game.
      </p>
    </form>
  );
}
