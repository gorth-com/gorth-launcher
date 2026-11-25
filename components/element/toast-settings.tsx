import { CardTitle, CardDescription } from "@gorth-com/primitive/default/card";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@gorth-com/primitive/custom/select";
import {
  toast,
  useToasterSettings,
  type ToastPosition,
} from "@/providers/toaster";

const options: { value: ToastPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];
export function ToastSettings() {
  const { position, setPosition } = useToasterSettings();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle id="toast-position-label">Toast position</CardTitle>
          <CardDescription>Choose where notifications appear.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              toast.add({
                title: "Preview notification",
                description: "Notifications appear in your selected corner.",
                type: "success",
              })
            }
          >
            Show toast
          </Button>
          <Select
            items={options}
            value={position}
            onValueChange={(value) => {
              if (options.some((option) => option.value === value))
                setPosition(value as ToastPosition);
            }}
          >
            <SelectTrigger
              aria-labelledby="toast-position-label"
              className="w-60"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
