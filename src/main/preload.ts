import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process
// to communicate with the main process
contextBridge.exposeInMainWorld('electronAPI', {
  openContentPackage: () => ipcRenderer.invoke('open-content-package'),
  loadLocalManifest: (manifestPath: string) => 
    ipcRenderer.invoke('load-local-manifest', manifestPath),
  getFileUrl: (filePath: string) => 
    ipcRenderer.invoke('get-file-url', filePath),
  getVideoUrl: (filePath: string) => 
    ipcRenderer.invoke('get-video-url', filePath),
  getAudioUrl: (filePath: string) => 
    ipcRenderer.invoke('get-audio-url', filePath),
});