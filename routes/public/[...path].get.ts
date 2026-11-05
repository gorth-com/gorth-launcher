import { defineHandler } from "nitro";
import { getRendererAsset } from "@/controllers/renderer";
export default defineHandler(getRendererAsset);
