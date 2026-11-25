import { defineHandler } from "nitro";
import { requireDesktop } from "@/middlewares/desktop";
import { actGetUserProfile } from "@/controllers/user-profile";
export default defineHandler({
  middleware: [requireDesktop()],
  handler: actGetUserProfile,
});
