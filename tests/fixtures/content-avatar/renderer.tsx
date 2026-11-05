import { createRoot } from "react-dom/client";
import { StrictMode, useEffect, useState } from "react";
import type { ContentProject } from "@/lib/content/interface";
import { ContentProjectCard } from "@/components/element/content-project-card";
import "@/styles/globals.css";

const project = {
  id: "sample",
  name: "Sample Mod",
  description: "Avatar test",
  downloads: 42,
};
const query = {
  provider: "modrinth" as const,
  kind: "mod" as const,
  query: "",
  version: "1.20.1",
  loader: "Fabric",
  offset: 0,
};
function LiveSearch() {
  const [project, setProject] = useState<ContentProject>();
  const [error, setError] = useState("");
  useEffect(() => {
    async function load() {
      try {
        const api = (
          window as unknown as {
            avatarTest: { search: () => Promise<ContentProject> };
          }
        ).avatarTest;
        setProject(await api.search());
      } catch (error) {
        setError(String(error));
      }
    }
    void load();
  }, []);
  return (
    <div data-live-search>
      {error ||
        (project && (
          <ContentProjectCard
            project={project}
            query={query}
            layout="list"
            busy={false}
            onOpen={() => {}}
            onInstall={() => {}}
          />
        ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div style={{ width: 800 }}>
      {["list", "grid"].map((layout) => (
        <div key={layout} data-layout={layout}>
          <ContentProjectCard
            project={{
              ...project,
              iconUrl: "https://avatar.fixture.test/icon.svg",
            }}
            query={query}
            layout={layout as "list" | "grid"}
            busy={false}
            onOpen={() => {}}
            onInstall={() => {}}
          />
        </div>
      ))}
      <LiveSearch />
      <div data-remote>
        <ContentProjectCard
          project={{
            ...project,
            iconUrl:
              "https://cdn.modrinth.com/data/AANobbMI/295862f4724dc3f78df3447ad6072b2dcd3ef0c9_96.webp",
          }}
          query={query}
          layout="list"
          busy={false}
          onOpen={() => {}}
          onInstall={() => {}}
        />
      </div>
    </div>
  </StrictMode>,
);
