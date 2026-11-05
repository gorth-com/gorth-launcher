import { useForm } from "@gorth-io/primitive/cores/tanstack/form";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@gorth-io/primitive/cores/tanstack/query";
import { useEffect } from "react";
import {
  Card,
  CardTitle,
  CardDescription,
} from "@gorth-io/primitive/default/card";
import { Separator } from "@gorth-io/primitive/default/separator";
import { Input } from "@gorth-io/primitive/default/input";
import { PasswordInput } from "@gorth-io/primitive/custom/input-password";
import { Switch } from "@gorth-io/primitive/default/switch";
import { RadioGroup, RadioGroupItem } from "@gorth-io/primitive/custom/radio";
import { Button } from "@gorth-io/primitive/custom/button";
import { toast } from "@/providers/toaster";
import { confirmAction } from "@/lib/confirmation";
import { defaultProxySettings, proxyUpdateSchema } from "@/lib/network/proxy";

const choices = [
  { value: "system", label: "Use system settings" },
  { value: "direct", label: "None" },
  { value: "socks5", label: "SOCKS5" },
  { value: "http", label: "HTTP" },
] as const;
export function ProxySettingsCard({ browser = false }: { browser?: boolean }) {
  const client = useQueryClient();
  const saved = useQuery({
    queryKey: ["network-proxy"],
    queryFn: () => window.electronAPI.networkProxy.get(),
  });
  useEffect(() => {
    if (saved.error)
      toast.add({ title: "Could not load proxy settings", type: "error" });
  }, [saved.error]);
  const apply = useMutation({
    mutationFn: window.electronAPI.networkProxy.save,
    onSuccess: (value) => {
      client.setQueryData(["network-proxy"], value);
      toast.add({ title: "Proxy settings saved", type: "success" });
    },
    onError: () =>
      toast.add({
        title: "Could not save proxy settings",
        description: "Check the address and system keychain, then try again.",
        type: "error",
      }),
  });
  const route = useMutation({
    mutationFn: () => window.electronAPI.networkProxy.route(),
    onSuccess: (value) =>
      toast.add({
        title: "Applied route for example.com",
        description: value,
        type: "info",
      }),
    onError: () =>
      toast.add({ title: "Could not resolve proxy route", type: "error" }),
  });
  const form = useForm({
    defaultValues: {
      ...defaultProxySettings,
      username: "",
      password: "",
      clearCredentials: false,
    },
    onSubmit: async ({ value }) => {
      const input = proxyUpdateSchema.safeParse({
        settings: { mode: value.mode, host: value.host, port: value.port },
        credentials: value.username
          ? { username: value.username, password: value.password }
          : undefined,
        clearCredentials: value.clearCredentials,
      });
      if (!input.success) {
        toast.add({
          title: "Invalid proxy settings",
          description: input.error.issues[0]?.message,
          type: "error",
        });
        return;
      }
      if (
        !(await confirmAction({
          title: "Apply proxy settings?",
          description:
            "Active app connections will be closed. Downloads or sign-in may need to be retried.",
          confirmLabel: "Apply",
        }))
      )
        return;
      await apply.mutateAsync(input.data).catch(() => undefined);
      form.setFieldValue("username", "");
      form.setFieldValue("password", "");
    },
  });
  useEffect(() => {
    if (saved.data)
      form.reset({
        ...saved.data,
        username: "",
        password: "",
        clearCredentials: false,
      });
  }, [saved.data, form]);
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-2 p-4">
        <CardTitle>Network proxy</CardTitle>
        <CardDescription>
          {browser
            ? "Applies to browser tabs and app requests."
            : "Applies to launcher requests, not the Minecraft process."}{" "}
          Local desktop connections stay direct. SOCKS5 authentication is not
          supported.
        </CardDescription>
      </div>
      <Separator />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        className="flex flex-col"
      >
        <div className="flex flex-col gap-4 p-4">
          <CardTitle>Type</CardTitle>
          <form.Field name="mode">
            {(field) => (
              <RadioGroup
                className="flex flex-col gap-4"
                value={field.state.value}
                onValueChange={(value) => {
                  if (choices.some((option) => option.value === value))
                    field.handleChange(value as typeof field.state.value);
                  form.setFieldValue("username", "");
                  form.setFieldValue("password", "");
                }}
              >
                {choices.map((option) => (
                  <label className="flex items-center gap-2" key={option.value}>
                    <RadioGroupItem value={option.value} />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
            )}
          </form.Field>
        </div>
        <Separator />
        <form.Subscribe selector={(state) => state.values.mode}>
          {(mode) => (
            <>
              <div className="flex flex-col gap-4 p-4">
                <CardTitle>Address and port</CardTitle>
                <div className="flex flex-wrap gap-4">
                  <form.Field name="host">
                    {(field) => (
                      <Input
                        aria-label="Proxy address"
                        placeholder="127.0.0.1"
                        className="min-w-0 flex-1"
                        disabled={
                          mode === "system" || mode === "direct" || !saved.data
                        }
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                      />
                    )}
                  </form.Field>
                  <form.Field name="port">
                    {(field) => (
                      <Input
                        aria-label="Proxy port"
                        type="number"
                        min={1}
                        max={65535}
                        className="w-28"
                        disabled={
                          mode === "system" || mode === "direct" || !saved.data
                        }
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(Number(event.target.value))
                        }
                      />
                    )}
                  </form.Field>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-4 p-4">
                <CardTitle>Authentication</CardTitle>
                <CardDescription>
                  {saved.data?.hasCredentials
                    ? "Credentials are saved in the system keychain format. Leave fields empty to keep them."
                    : "Optional HTTP proxy credentials are encrypted on this device."}
                </CardDescription>
                <form.Field name="username">
                  {(field) => (
                    <Input
                      aria-label="Proxy username"
                      autoComplete="off"
                      placeholder="Username"
                      disabled={mode !== "http" || !saved.data}
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                  )}
                </form.Field>
                <form.Field name="password">
                  {(field) => (
                    <PasswordInput
                      aria-label="Proxy password"
                      autoComplete="new-password"
                      type="password"
                      placeholder="Password"
                      disabled={mode !== "http" || !saved.data}
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                    />
                  )}
                </form.Field>
                {saved.data?.hasCredentials && (
                  <form.Field name="clearCredentials">
                    {(field) => (
                      <label className="flex items-center gap-2">
                        <Switch
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                        />
                        Remove saved credentials
                      </label>
                    )}
                  </form.Field>
                )}
              </div>
            </>
          )}
        </form.Subscribe>
        <Separator />
        <div className="flex flex-wrap gap-2 p-4">
          <Button type="submit" disabled={!saved.data || apply.isPending}>
            Apply
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!saved.data || route.isPending || apply.isPending}
            onClick={() => route.mutate()}
          >
            Show applied route
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!saved.data || apply.isPending}
            onClick={() =>
              saved.data &&
              form.reset({
                ...saved.data,
                username: "",
                password: "",
                clearCredentials: false,
              })
            }
          >
            Reset changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
