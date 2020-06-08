const { ipcRenderer } = require("electron");

let running = false;
function startServer() {
  if (!running) {
    const port = document.getElementById("port").value;
    const external = document.getElementById("external").value;
    const excluded = document.getElementById("excluded").value;
    ipcRenderer.send("start", { port, external, excluded });
    document.getElementById("start").textContent = "STOP";
  } else {
    ipcRenderer.send("stop", {});
    document.getElementById("start").textContent = "START SERVER";
  }
  running = !running;
}

document.getElementById("start").addEventListener("click", startServer);
startServer();

// main.jsからの通知で起動
ipcRenderer.on("log", function (event, log) {
  document.getElementById("log-history").textContent += log + "\n";
  const frame = document.getElementById("log-frame");
  frame.scrollTop = frame.scrollHeight - frame.clientHeight;
  console.log(frame.scrollTo, frame.scrollHeight, frame.clientHeight);
});
ipcRenderer.on("host", function (event, ip) {
  Array.from(document.getElementsByClassName("host")).map(
    (span) => (span.textContent = ip)
  );
});
