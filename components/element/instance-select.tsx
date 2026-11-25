import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@gorth-com/primitive/custom/select";
export function InstanceSelect({
  items,
  value,
  onChange,
  label,
  disabled = false,
}: {
  items: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(value) => {
        if (value !== null) onChange(String(value));
      }}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
