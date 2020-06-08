const http = require("http");
const url = require("url");
const net = require("net");
const fs = require("fs");

let mainWindow = null;
let server = null;
function createServer(window, data) {
  mainWindow = window;
  const HTTP_PORT = data.port; // internal proxy server port
  const PROXY_URL = data.external; // external proxy server URL
  const PROXY_HOST = PROXY_URL ? url.parse(PROXY_URL).hostname : null;
  const PROXY_PORT = PROXY_URL ? url.parse(PROXY_URL).port || 80 : null;
  const DIRECT_HOSTS = data.excluded.split(",");

  stopServer();
  server = http
    .createServer(function onCliReq(cliReq, cliRes) {
      info("onCliReq", cliReq.url);
      let svrSoc;
      const urlInfo = url.parse(cliReq.url);
      const cliSoc = cliReq.socket;
      const isDirect = DIRECT_HOSTS.indexOf(urlInfo.hostname) >= 0;
      const host = isDirect ? urlInfo.hostname : PROXY_HOST || urlInfo.hostname;
      const port = isDirect
        ? urlInfo.port || 80
        : PROXY_PORT || urlInfo.port || 80;
      const path = isDirect
        ? urlInfo.path
        : PROXY_URL
        ? cliReq.url
        : urlInfo.path;

      const svrReq = http.request(
        {
          host,
          port,
          path,
          method: cliReq.method,
          headers: cliReq.headers,
          agent: cliSoc.$agent,
        },
        function onSvrRes(svrRes) {
          svrSoc = svrRes.socket;
          cliRes.writeHead(svrRes.statusCode, svrRes.headers);
          svrRes.pipe(cliRes);
        }
      );
      cliReq.pipe(svrReq);
      svrReq.on("error", function onSvrReqErr(err) {
        cliRes.writeHead(400, err.message, { "content-type": "text/html" });
        cliRes.end("<h1>" + err.message + "<br/>" + cliReq.url + "</h1>");
        onErr(
          err,
          "svrReq",
          urlInfo.hostname + ":" + (urlInfo.port || 80),
          svrSoc
        );
      });
    })
    .on("clientError", (err, soc) => onErr(err, "cliErr", "", soc))
    .on("connect", function onCliConn(cliReq, cliSoc, cliHead) {
      info("connect", cliReq.url);
      const urlInfo = url.parse("https://" + cliReq.url);
      const isDirect = DIRECT_HOSTS.indexOf(urlInfo.hostname) >= 0;
      let svrSoc;
      if (PROXY_URL && !isDirect) {
        const svrReq = http.request({
          host: PROXY_HOST,
          port: PROXY_PORT,
          path: cliReq.url,
          method: cliReq.method,
          headers: cliReq.headers,
          agent: cliSoc.$agent,
        });
        svrReq.end();
        svrReq.on("connect", function onSvrConn(svrRes, svrSoc2, svrHead) {
          svrSoc = svrSoc2;
          cliSoc.write("HTTP/1.0 200 Connection established\r\n\r\n");
          if (cliHead && cliHead.length) svrSoc.write(cliHead);
          if (svrHead && svrHead.length) cliSoc.write(svrHead);
          svrSoc.pipe(cliSoc);
          cliSoc.pipe(svrSoc);
          svrSoc.on("error", (err) => onErr(err, "svrSoc", cliReq.url, cliSoc));
        });
        svrReq.on("error", (err) => onErr(err, "svrRq2", cliReq.url, cliSoc));
      } else {
        svrSoc = net.connect(
          urlInfo.port || 443,
          urlInfo.hostname,
          function onSvrConn() {
            cliSoc.write("HTTP/1.0 200 Connection established\r\n\r\n");
            if (cliHead && cliHead.length) svrSoc.write(cliHead);
            cliSoc.pipe(svrSoc);
          }
        );
        svrSoc.pipe(cliSoc);
        svrSoc.on("error", (err) => onErr(err, "svrSoc", cliReq.url, cliSoc));
      }
      cliSoc.on("error", (err) => onErr(err, "cliSoc", cliReq.url, svrSoc));
    })
    .on("connection", function onConn(cliSoc) {
      cliSoc.$agent = new http.Agent({ keepAlive: true });
      cliSoc.$agent.on("error", (err) => console.log("agent:", err));
    })
    .listen(HTTP_PORT, () => {
      log(
        "http proxy server started on port " +
          HTTP_PORT +
          (PROXY_URL ? " -> " + PROXY_HOST + ":" + PROXY_PORT : "")
      );
    });
}
module.exports.createServer = createServer;

function stopServer() {
  if (server) {
    // TDOD: can not stop
    server.close();
    log("http proxy server stopped.");
  }
  server = null;
}
module.exports.stopServer = stopServer;

function log(msg) {
  console.log(msg);
  mainWindow.webContents.send("log", msg);
}

function info(msg, url) {
  log(`${new Date().toLocaleTimeString()} ${msg}: ${url}`);
}

function onErr(err, msg, url, soc) {
  if (soc) soc.end();
  log(`${new Date().toLocaleTimeString()} ${msg}: ${url} ${err + ""}`);
}
