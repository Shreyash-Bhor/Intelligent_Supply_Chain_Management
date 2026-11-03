"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay className={cn("dialog-overlay fixed inset-0 z-[80] bg-black/55 backdrop-blur-[2px]", className)} {...props} />;
}

function DialogContent({ className, children, showClose = true, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return <DialogPortal><DialogOverlay/><DialogPrimitive.Content className={cn("dialog-content bg-background text-foreground fixed left-1/2 top-1/2 z-[81] flex h-[min(84dvh,760px)] max-h-[84dvh] w-[min(96vw,680px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border shadow-2xl outline-none", className)} {...props}>{children}{showClose && <DialogPrimitive.Close aria-label="Close dialog" className="sr-only"><X/></DialogPrimitive.Close>}</DialogPrimitive.Content></DialogPortal>;
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("shrink-0 border-b px-5 py-4 sm:px-6", className)} {...props}/>;
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props}/>;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-muted-foreground mt-1 text-sm", className)} {...props}/>;
}

export { Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogTitle, DialogDescription };
