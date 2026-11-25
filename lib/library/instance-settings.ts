import { z } from "@gorth-com/structure/cores/zod";
import type { InstanceSettings, Settings } from "@/utils/interface";
import {
  javaPreferences,
  minecraftPreferences,
  javaPreferencesSchema,
  minecraftPreferencesSchema,
} from "./game-preferences";
import { instanceOverridesSchema } from "./instance-overrides";

const safeText = (maximum: number) =>
  z
    .string()
    .max(maximum)
    .refine(
      (value) => !value.includes("\0"),
      "Giá trị chứa ký tự không hợp lệ.",
    );

export const instanceSettingsSchema = z
  .object({
    overrides: instanceOverridesSchema.optional(),
    javaOptions: javaPreferencesSchema.optional(),
    minecraftOptions: minecraftPreferencesSchema.optional(),
    wrapperCommand: safeText(4096).optional(),
    nativeLibraries: z
      .object({
        glfw: z.boolean(),
        openAl: z.boolean(),
        openGl: z.boolean(),
      })
      .optional(),
    memoryMin: z
      .number()
      .min(0.125)
      .max(64)
      .multipleOf(1 / 1024),
    memoryMax: z
      .number()
      .min(0.125)
      .max(64)
      .multipleOf(1 / 1024),
    javaPath: safeText(4096),
    jvmArguments: z.array(safeText(1024)).max(128),
    resolutionWidth: z.number().int().min(320).max(16384),
    resolutionHeight: z.number().int().min(240).max(16384),
    fullscreen: z.boolean(),
    environment: z
      .record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), safeText(4096))
      .refine(
        (value) => Object.keys(value).length <= 64,
        "Chỉ cho phép tối đa 64 biến môi trường.",
      ),
    accountId: z.string().max(100).nullable(),
    joinServer: safeText(255),
    joinWorld: safeText(255),
    preLaunchCommand: safeText(4096),
    postExitCommand: safeText(4096),
    gpuPreference: z.enum(["default", "high-performance", "integrated"]),
    openGlPath: safeText(4096),
    openAlPath: safeText(4096),
    glfwPath: safeText(4096),
  })
  .refine((value) => value.memoryMin <= value.memoryMax, {
    message: "RAM tối thiểu không được lớn hơn RAM tối đa.",
  })
  .refine((value) => !(value.joinServer && value.joinWorld), {
    message: "Chỉ có thể vào server hoặc world, không thể chọn cả hai.",
  })
  .refine(
    (value) => !value.overrides?.javaInstallation || !!value.javaPath.trim(),
    {
      message: "Chọn Java executable khi bật Java installation override.",
    },
  )
  .refine((value) => !value.overrides?.account || !!value.accountId, {
    message: "Chọn tài khoản khi bật Override default account.",
  })
  .refine(
    (value) =>
      !value.overrides?.autoJoin ||
      !!(value.joinServer.trim() || value.joinWorld.trim()),
    {
      message: "Chọn server hoặc world khi bật Auto-join.",
    },
  )
  .refine(
    (value) =>
      !value.overrides?.nativeLibraries ||
      !value.nativeLibraries ||
      ((!value.nativeLibraries.glfw || !!value.glfwPath.trim()) &&
        (!value.nativeLibraries.openAl || !!value.openAlPath.trim()) &&
        (!value.nativeLibraries.openGl || !!value.openGlPath.trim())),
    {
      message: "Nhập đường dẫn cho mỗi native library đang bật.",
    },
  );

export function defaultInstanceSettings(settings: Settings): InstanceSettings {
  const java = javaPreferences(settings);
  const minecraft = minecraftPreferences(settings);
  return {
    overrides: instanceOverridesSchema.parse({}),
    javaOptions: java,
    minecraftOptions: minecraft,
    wrapperCommand: "",
    memoryMin: java.memoryMinMiB / 1024,
    memoryMax: java.memoryMaxMiB / 1024,
    // New instances inherit the current launcher default/major-specific paths.
    // Older records without flags still treat a nonempty path as an override.
    javaPath: "",
    jvmArguments: [],
    resolutionWidth: minecraft.windowWidth,
    resolutionHeight: minecraft.windowHeight,
    fullscreen: false,
    environment: {},
    accountId: null,
    joinServer: "",
    joinWorld: "",
    preLaunchCommand: minecraft.preLaunchCommand,
    postExitCommand: minecraft.postExitCommand,
    gpuPreference: minecraft.gpuPreference,
    openGlPath: minecraft.openGlPath,
    openAlPath: minecraft.openAlPath,
    glfwPath: minecraft.glfwPath,
  };
}
