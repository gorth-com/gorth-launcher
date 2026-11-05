import { defineHandler } from "nitro";
import { receiveAuthCallback } from "@/controllers/auth";
export default defineHandler(receiveAuthCallback);
