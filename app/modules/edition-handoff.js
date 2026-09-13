// Durable edition handoff, separate from the ordinary autosave slot.
window.BwsEditionBridge={
 async save(){
  if(sessionStorage.getItem("boltworks.edition.restore.v1")==="pending")throw Error("A workspace restore is still pending. Reload to retry restoring the protected backup before switching editions.");
  if(isProjectLoading||isRestoring||bwsStartingNewWorkspace)throw Error("Wait for the current project operation to finish before switching.");
  if(bwsAutoSaveTimer){clearTimeout(bwsAutoSaveTimer);bwsAutoSaveTimer=null;}
  await bwsAutoSavePromise.catch(()=>false);
  const generation=bwsWorkspaceGeneration;
  const project=projectState();
  const room=typeof bwsSceneStudio!=="undefined"&&bwsSceneStudio?.editionSnapshot?bwsSceneStudio.editionSnapshot():null;
  const record={id:"edition-handoff",savedAt:new Date().toISOString(),project,room};
  const database=await openBwsRecoveryDatabase();
  await new Promise((resolve,reject)=>{const tx=database.transaction(BWS_RECOVERY_STORE,"readwrite");tx.objectStore(BWS_RECOVERY_STORE).put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error("Workspace save failed."));tx.onabort=()=>reject(Error("Workspace save was interrupted."));});
  if(generation!==bwsWorkspaceGeneration)throw Error("The workspace changed while saving. Please try again.");
  sessionStorage.setItem("boltworks.edition.restore.v1","pending");
  setBwsAutoSaveStatus("Workspace saved for edition switch","saved");
 },
 async restore(){
  if(sessionStorage.getItem("boltworks.edition.restore.v1")!=="pending")return false;
  try{
   const database=await openBwsRecoveryDatabase();
   const record=await new Promise((resolve,reject)=>{const req=database.transaction(BWS_RECOVERY_STORE,"readonly").objectStore(BWS_RECOVERY_STORE).get("edition-handoff");req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
   if(!record?.project)throw Error("The saved edition workspace could not be found.");
   await loadProjectData(record.project,"Workspace saved before edition switch");
   if(record.room){openBwsSceneStudio();await bwsSceneStudio.editionRestore(record.room);}
   sessionStorage.removeItem("boltworks.edition.restore.v1");
   setBwsAutoSaveStatus("Workspace restored after edition switch","saved");log("Your saved workspace has been restored after switching editions.");return true;
  }catch(error){
   setBwsAutoSaveStatus("Edition restore needs attention","problem");log("Edition restore failed: "+error.message+". The handoff backup has been retained.");
   if(window.BwsEditionRestoreError)window.BwsEditionRestoreError(error.message);
   return true; // Do not load a different recovery over a failed handoff.
  }
 }
};
