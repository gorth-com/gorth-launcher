import { useForm } from "@gorth-io/primitive/cores/tanstack/form";
import {
  Globe2,
  UserRound,
  Rocket,
  Star,
} from "@gorth-io/primitive/cores/lucide";
import { CardTitle } from "@gorth-io/primitive/default/card";
import { Input } from "@gorth-io/primitive/default/input";
import { Button } from "@gorth-io/primitive/custom/button";
import type { Settings } from "@/utils/interface";
import type { Dispatch, SetStateAction } from "react";
const icons = { globe: Globe2, user: UserRound, rocket: Rocket, star: Star };
export function ProfilePreferences({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
}) {
  const form = useForm({
    defaultValues: {
      name: settings.profileName ?? "Personal",
      icon: settings.profileIcon ?? "user",
    },
    onSubmit: ({ value }) => {
      const name = value.name.trim();
      if (name && name.length <= 80)
        setSettings((previous) => ({
          ...previous,
          profileName: name,
          profileIcon: value.icon,
        }));
    },
  });
  return (
    <>
      <form
        className="flex flex-col gap-4 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Profile name</CardTitle>
              <Input
                className="w-45"
                aria-label="Profile name"
                required
                maxLength={80}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </div>
          )}
        </form.Field>
        <div className="flex items-center justify-between gap-4">
          <Button type="submit">Save profile</Button>
          <form.Field name="icon">
            {(field) => (
              <div className="flex flex-wrap gap-2">
                {Object.entries(icons).map(([key, Icon]) => (
                  <Button
                    key={key}
                    type="button"
                    aria-label={`${key} profile icon`}
                    aria-pressed={field.state.value === key}
                    variant={field.state.value === key ? "default" : "outline"}
                    onClick={() =>
                      field.handleChange(key as keyof typeof icons)
                    }
                  >
                    <Icon />
                  </Button>
                ))}
              </div>
            )}
          </form.Field>
        </div>
      </form>
    </>
  );
}
