const { app, BrowserWindow, ipcMain } = require("electron");
const { createServer, stopServer } = require("./server");

// get ip
function setFirstClassCIp() {
  const nets = require("os").networkInterfaces();
  mainWindow.webContents.send(
    "log",
    "networkInterfaces: " + JSON.stringify(nets, undefined, 2)
  );
  for (const key of Object.keys(nets)) {
    const net = nets[key];
    for (const n of net) {
      if (
        n.internal === false &&
        n.family === "IPv4" &&
        n.address.startsWith("192.168.")
      ) {
        mainWindow.webContents.send("host", n.address);
        return;
      }
    }
  }
}

// create window
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
    },
    width: 930,
    height: 700,
    icon: __dirname + "/favicon.ico",
  });
  mainWindow.loadFile("view.html");
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.removeMenu();
  // mainWindow.webContents.openDevTools();
}

// app handler
app.on("ready", createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // macOSのとき以外はアプリケーションを終了
    app.quit();
  }
});
app.on("activate", () => {
  // アプリケーションがアクティブになった時の処理(MacだとDockがクリックされた時）
  if (mainWindow === null) {
    // メインウィンドウが消えている場合は再度メインウィンドウを作成
    createWindow();
  }
});

// event from window
ipcMain.on("start", (event, data) => {
  setFirstClassCIp();
  createServer(mainWindow, data);
});
ipcMain.on("stop", (event, data) => {
  stopServer();
});
