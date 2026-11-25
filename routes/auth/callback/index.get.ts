import { defineHandler } from "nitro";
import { actReceiveAuthCallback } from "@/controllers/auth";
export default defineHandler(actReceiveAuthCallback);
