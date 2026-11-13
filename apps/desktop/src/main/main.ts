import { app, BrowserWindow, shell, protocol, net } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveRendererRequestPath } from './protocol-path';
protocol.registerSchemesAsPrivileged([{scheme:'kingsfort',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let mainWindow:BrowserWindow|undefined;
function createWindow(){
 mainWindow=new BrowserWindow({width:1440,height:920,minWidth:1100,minHeight:720,show:false,backgroundColor:'#f5f7fb',title:'KingsFortProperty',webPreferences:{preload:path.join(__dirname,'../preload/preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 mainWindow.once('ready-to-show',()=>mainWindow?.show());
 mainWindow.webContents.setWindowOpenHandler(({url})=>{if(url.startsWith('https://'))void shell.openExternal(url);return {action:'deny'};});
 if(process.env.VITE_DEV_SERVER_URL)void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);else void mainWindow.loadURL('kingsfort://app/index.html');
}
app.whenReady().then(()=>{const rendererRoot=path.join(__dirname,'../renderer');protocol.handle('kingsfort',async request=>{const safePath=await resolveRendererRequestPath(request.url,rendererRoot);if(!safePath)return new Response('Not found',{status:404});return net.fetch(pathToFileURL(safePath).toString());});createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
