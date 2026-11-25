import { createRoot } from "react-dom/client";
import { Button } from "@gorth-com/primitive/custom/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/custom/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/custom/tooltip";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>Tooltip</TooltipTrigger>
      <TooltipContent>Details</TooltipContent>
    </Tooltip>
    <Button id="runtime-ready">Ready</Button>
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>Runtime ready</AlertDialogTitle>
        <AlertDialogDescription>
          Published libraries loaded.
        </AlertDialogDescription>
      </AlertDialogContent>
    </AlertDialog>
  </TooltipProvider>,
);
