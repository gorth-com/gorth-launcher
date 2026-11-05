import { defineHandler } from "nitro";
import { requireDesktop } from "@/middlewares/desktop";
import { getUserProfile } from "@/controllers/user-profile";
export default defineHandler({
  middleware: [requireDesktop()],
  handler: getUserProfile,
});
