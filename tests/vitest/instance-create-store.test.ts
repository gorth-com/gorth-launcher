import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { createLibraryStore } from "@/services/library-store";
it("persists create metadata atomically and preserves it on reopen", async () => {
 const directory=await mkdtemp(path.join(tmpdir(),"gorth-instance-create-"));
 let store:Awaited<ReturnType<typeof createLibraryStore>>|undefined;
 try{
  store=await createLibraryStore(directory,()=>false);
  await store.command({action:"create",name:" Native world ",version:"1.20.1",loader:"Vanilla",group:"Friends",iconData:"lucide:star"});
  const created=store.snapshot().instances[0];
  expect(created).toMatchObject({name:"Native world",group:"Friends",iconData:"lucide:star"});
  expect(created.id).toMatch(/^[a-f0-9-]{36}$/);
  await expect(store.command({action:"create",name:"Invalid",version:"1.20.1",loader:"Vanilla",iconData:"remote-image"})).rejects.toThrow();
  expect(store.snapshot().instances).toHaveLength(1);
  store.close();store=undefined;
  store=await createLibraryStore(directory,()=>false);
  expect(store.snapshot().instances[0]).toMatchObject(created);
  expect(store.snapshot().instanceSettings[created.id]).toBeDefined();
 }finally{store?.close();await rm(directory,{recursive:true,force:true});}
});

