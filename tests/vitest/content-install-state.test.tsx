import { afterEach, expect, it, vi } from "vitest";
import { isValidElement, type ReactNode } from "react";
import {
  beginContent,
  cancelContent,
  contentSnapshot,
  finishContent,
  updateContent,
} from "@/lib/content/state";
import { ContentProjectCard } from "@/components/element/content-project-card";

afterEach(() => finishContent());

it("keeps ordered, bounded install logs, resets them per operation and protects snapshots", () => {
  beginContent();
  updateContent("Download a.jar", 0, 2);
  updateContent("Download b.jar", 1, 2);
  const snapshot = contentSnapshot();
  expect(snapshot.logs?.slice(-2)).toEqual([
    "Download a.jar (0/2)",
    "Download b.jar (1/2)",
  ]);
  snapshot.logs?.push("Not a real log");
  expect(contentSnapshot().logs).not.toContain("Not a real log");
  for (let i = 0; i < 1100; i++) updateContent(`file-${i}`);
  expect(contentSnapshot().logs).toHaveLength(1000);
  finishContent();
  expect(contentSnapshot()).toMatchObject({ busy: false });
  expect(contentSnapshot().logs?.at(-1)).toBe("Cài đặt hoàn tất.");
  beginContent();
  expect(contentSnapshot().logs).toEqual(["Đang chuẩn bị…"]);
});

it("cancels the active install without reporting successful completion", () => {
  const signal = beginContent();
  updateContent("Downloading", 1, 3);
  cancelContent();
  expect(signal.aborted).toBe(true);
  finishContent("Đã hủy cài nội dung.");
  expect(contentSnapshot()).toMatchObject({
    busy: false,
    completed: 1,
    error: "Đã hủy cài nội dung.",
  });
});

it("opens installation for Download/Install and preview only for the project name", () => {
  const onOpen = vi.fn();
  const onInstall = vi.fn();
  const tree = ContentProjectCard({
    project: {
      id: "test",
      url: "https://www.curseforge.com/minecraft/modpacks/test",
      name: "Test pack",
      description: "",
      downloads: 0,
    },
    layout: "list",
    busy: false,
    onOpen,
    onInstall,
  });
  const elements: {
    children?: ReactNode;
    onClick?: () => void;
    title?: string;
  }[] = [];
  function walk(node: ReactNode) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (
      !isValidElement<{
        children?: ReactNode;
        onClick?: () => void;
        title?: string;
      }>(node)
    )
      return;
    elements.push(node.props);
    walk(node.props.children);
  }
  walk(tree);
  elements.find((props) => props.title === "Chọn phiên bản để tải và cài đặt")!
    .onClick!();
  expect(onInstall).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
  elements.find((props) => props.children === "Install")!.onClick!();
  expect(onInstall).toHaveBeenCalledTimes(2);
  elements.find((props) => props.children === "Test pack" && props.onClick)!
    .onClick!();
  expect(onOpen).toHaveBeenCalledTimes(1);
});
